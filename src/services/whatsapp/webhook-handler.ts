import { prisma, initPragmas } from "@/lib/prisma";
import { findOrCreateByPhone } from "@/services/contacts/resolver";
import { routeToConversation } from "@/services/conversations/router";
import { slaEngine } from "@/services/sla/engine";

interface WaTextMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body?: string };
  type?: string;
  image?: unknown;
  document?: unknown;
  audio?: unknown;
  video?: unknown;
}

interface WaStatus {
  id: string;
  status?: string;
  timestamp?: string;
}

interface WaChange {
  field?: string;
  value?: {
    messaging_product?: string;
    messages?: WaTextMessage[];
    statuses?: WaStatus[];
    contacts?: { profile?: { name?: string }; wa_id?: string }[];
  };
}

export interface WebhookPayload {
  object?: string;
  entry?: { id?: string; changes?: WaChange[] }[];
}

export async function processWebhookPayload(payload: WebhookPayload): Promise<{ processed: number }> {
  await initPragmas();
  let processed = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      // Solo nos interesan los mensajes entrantes; los status se descartan
      const messages = value.messages || [];
      for (const waMsg of messages) {
        const handled = await handleIncomingMessage(waMsg, value);
        if (handled) processed++;
      }
    }
  }

  return { processed };
}

async function handleIncomingMessage(waMsg: WaTextMessage, value: NonNullable<WaChange["value"]>): Promise<boolean> {
  const wamid = waMsg.id;
  if (!wamid) return false;

  // Dedup por WAMID
  const existing = await prisma.message.count({ where: { channel: "WHATSAPP", externalId: wamid } });
  if (existing > 0) return false;

  const from = waMsg.from;
  if (!from) return false;

  const profileName = value.contacts?.find((c) => c.wa_id === from)?.profile?.name || null;

  const contact = await findOrCreateByPhone(from, profileName);

  const routed = await routeToConversation({
    contactId: contact.id,
    channel: "WHATSAPP",
    subject: null,
    threadRef: null,
    receivedAt: new Date(Number(waMsg.timestamp) * 1000),
    senderKey: from,
  });

  // Solo texto por ahora; media → placeholder
  let body: string;
  let type: string = waMsg.type || "text";
  if (waMsg.text?.body) {
    body = waMsg.text.body;
  } else {
    type = typeof type === "string" && type !== "text" ? type : "text";
    body = `📎 [${typePreset(type)} recibido]`;
  }

  await prisma.message.create({
    data: {
      conversationId: routed.conversationId,
      channel: "WHATSAPP",
      externalId: wamid,
      direction: "INBOUND",
      sender: from,
      recipient: null,
      body,
      receivedAt: new Date(Number(waMsg.timestamp) * 1000),
      meta: JSON.stringify({ type, from }),
    },
  });

  await slaEngine.onInbound(routed.conversationId, new Date(Number(waMsg.timestamp) * 1000));

  console.log(`💬 WhatsApp de ${from}: "${body.slice(0, 60)}" → ${routed.isNew ? "NUEVA conversación" : "hilo existente"}`);

  return true;
}

function typePreset(type: string): string {
  const map: Record<string, string> = {
    image: "imagen",
    document: "documento",
    audio: "audio",
    video: "video",
    sticker: "sticker",
    location: "ubicación",
    contacts: "contacto",
    button: "botón",
  };
  return map[type] || type;
}