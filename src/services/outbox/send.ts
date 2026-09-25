import { prisma, initPragmas } from "@/lib/prisma";
import { slaEngine } from "@/services/sla/engine";
import { sendEmail } from "@/services/email/smtp";

export interface ReplyInput {
  conversationId: string;
  body: string;
}

export interface ReplyResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  slaSeconds?: number | null;
}

/**
 * Envía una respuesta del agente por el canal del último inbound
 * y actualiza el SLA y las alertas. Es la caja de respuesta de la UI.
 */
export async function sendAgentReply(input: ReplyInput): Promise<ReplyResult> {
  await initPragmas();

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      contact: true,
      messages: { orderBy: { receivedAt: "desc" }, take: 1 },
    },
  });

  if (!conversation) {
    return { ok: false, error: "Conversación no encontrada" };
  }

  const lastMessage = conversation.messages[0];
  const channel = lastMessage?.channel || conversation.channel;

  let externalId: string;
  const sentAt = new Date();

  try {
    if (channel === "EMAIL") {
      const targetEmail = conversation.contact.email;
      if (!targetEmail) {
        return { ok: false, error: "El contacto no tiene email para responder" };
      }
      const references = extractReferences(lastMessage?.meta);
      const messageId = await sendEmail({
        to: targetEmail,
        subject: lastMessage?.subject ? `Re: ${stripRe(lastMessage.subject)}` : "Re: conversación",
        text: input.body,
        inReplyTo: lastMessage?.externalId,
        references,
      });
      externalId = messageId;
    } else {
      const { sendWhatsAppText } = await import("@/services/whatsapp/client");
      const targetPhone = conversation.contact.phone;
      if (!targetPhone) {
        return { ok: false, error: "El contacto no tiene teléfono para responder" };
      }
      const wamid = await sendWhatsAppText(targetPhone, input.body);
      externalId = wamid;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de envío";
    console.error("Fallo al enviar respuesta:", err);

    // Guardamos el intento fallido para que el agente pueda ver el error
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        channel,
        externalId: `failed-${Date.now()}`,
        direction: "OUTBOUND",
        sender: channel === "EMAIL" ? (conversation.contact.email || "") : (conversation.contact.phone || ""),
        recipient: channel === "EMAIL" ? (conversation.contact.email || "") : (conversation.contact.phone || ""),
        body: input.body,
        sentAt,
        receivedAt: sentAt,
        isAgentReply: false,
        meta: JSON.stringify({ error: message }),
      },
    });
    return { ok: false, error: `No se pudo enviar: ${message}` };
  }

  // Registra la respuesta como mensaje outbound
  const created = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel,
      externalId,
      direction: "OUTBOUND",
      sender: channel === "EMAIL" ? (conversation.contact.email || "") : (conversation.contact.phone || ""),
      recipient: channel === "EMAIL" ? (conversation.contact.email || "") : (conversation.contact.phone || ""),
      subject: lastMessage?.subject ? `Re: ${stripRe(lastMessage.subject)}` : null,
      body: input.body,
      sentAt,
      receivedAt: sentAt,
      isAgentReply: true,
    },
  });

  // SLA: si es la primera respuesta del agente, calcular métrica
  let slaSeconds: number | null = null;
  const sla = await slaEngine.onAgentReply(conversation.id, sentAt);
  slaSeconds = sla?.slaSeconds ?? null;
  await slaEngine.markMessageAsFirstResponse(created.id, slaSeconds);

  // Ack de alertas pendientes/sent
  await prisma.alert.updateMany({
    where: {
      conversationId: conversation.id,
      status: { in: ["PENDING", "SENT"] },
    },
    data: { status: "ACKED" },
  });

  return { ok: true, messageId: externalId, slaSeconds };
}

function stripRe(subject: string): string {
  return subject.replace(/^(\s*re:\s*)+/i, "").trim();
}

function extractReferences(meta: string | null | undefined): string | null {
  const parsed = safeParseJson(meta || "");
  if (!parsed) return null;
  const refs = parsed.references;
  return typeof refs === "string" && refs ? refs : null;
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}