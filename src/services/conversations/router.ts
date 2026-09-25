import { prisma } from "@/lib/prisma";

export interface RouterInput {
  contactId: string;
  channel: "EMAIL" | "WHATSAPP";
  subject?: string | null;
  threadRef?: string | null;
  receivedAt: Date;
  senderKey: string; // email o teléfono del remitente
}

interface RouterResult {
  conversationId: string;
  isNew: boolean;
}

/**
 * Decide a qué conversación pertenece un mensaje entrante.
 * - Email: 1) References/In-Reply-To coincide con un Message.externalId existente
 *           2) mismo contacto + subject normalizado en los últimos 7 días
 *           3) conversación nueva
 * - WhatsApp: la conversación OPEN (o que más tarde se respondió) del contacto;
 *             si todas están cerradas/respondidas hace > 24h, una nueva.
 */
export async function routeToConversation(input: RouterInput): Promise<RouterResult> {
  if (input.channel === "EMAIL") {
    return routeEmail(input);
  }
  return routeWhatsApp(input);
}

async function routeEmail(input: RouterInput): Promise<RouterResult> {
  // 1) Unir al hilo por references
  if (input.threadRef) {
    const referenced = await prisma.message.findFirst({
      where: {
        channel: "EMAIL",
        externalId: input.threadRef,
      },
    });
    if (referenced) {
      return { conversationId: referenced.conversationId, isNew: false };
    }
  }

  // 2) Mismo contacto + subject reciente
  if (input.subject) {
    const normalizedSubject = normalizeSubject(input.subject);
    const recent = await prisma.conversation.findFirst({
      where: {
        contactId: input.contactId,
        channel: "EMAIL",
        lastIncomingAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
      include: { messages: { orderBy: { receivedAt: "desc" }, take: 1 } },
    });

    if (recent) {
      const lastMsgSubject = recent.messages[0]?.subject;
      if (lastMsgSubject && normalizeSubject(lastMsgSubject) === normalizedSubject) {
        return { conversationId: recent.id, isNew: false };
      }
    }
  }

  // 3) Nueva conversación
  const conv = await prisma.conversation.create({
    data: {
      contactId: input.contactId,
      subject: input.subject || "(sin asunto)",
      channel: "EMAIL",
      status: "OPEN",
      lastIncomingAt: input.receivedAt,
      threadRef: null,
    },
  });
  return { conversationId: conv.id, isNew: true };
}

async function routeWhatsApp(input: RouterInput): Promise<RouterResult> {
  // Conversación activa del contacto (OPEN o respondida recientemente)
  const active = await prisma.conversation.findFirst({
    where: {
      contactId: input.contactId,
      channel: "WHATSAPP",
      lastIncomingAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return { conversationId: active.id, isNew: false };
  }

  const conv = await prisma.conversation.create({
    data: {
      contactId: input.contactId,
      channel: "WHATSAPP",
      status: "OPEN",
      lastIncomingAt: input.receivedAt,
    },
  });
  return { conversationId: conv.id, isNew: true };
}

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^re:\s*|^fwd?:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca el Message-ID raíz en las cabeceras References/In-Reply-To.
 * References viene separado por espacios o comas.
 */
export function extractRootMessageId(references?: string | null, inReplyTo?: string | null): string | null {
  const refs = [references, inReplyTo].filter(Boolean).join(" ");
  if (!refs.trim()) return null;
  const ids = refs.match(/<[^>]+>/g);
  if (!ids || ids.length === 0) return null;
  // References: el primero suele ser la raíz
  return ids[0].slice(1, -1);
}