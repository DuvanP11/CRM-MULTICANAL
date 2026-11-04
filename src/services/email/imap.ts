import { ImapFlow } from "imapflow";
import { getConfig } from "@/lib/config";
import { parseEmail, dedupKey, type ParsedEmail } from "@/services/email/parse";
import { initPragmas } from "@/lib/prisma";

export interface FetchedEmail extends ParsedEmail {
  uid: number;
  seen: boolean; // ya leído en Gmail al momento de bajarlo
}

export async function connectImap() {
  const env = await getConfig();
  if (!env.imapUser || !env.imapPassword) {
    throw new Error("IMAP no configurado: faltan EMAIL_IMAP_USER / EMAIL_IMAP_PASSWORD");
  }

  const client = new ImapFlow({
    host: env.imapHost,
    port: env.imapPort,
    secure: true,
    auth: {
      user: env.imapUser,
      pass: env.imapPassword,
    },
    logger: false,
  });

  await client.connect();
  return client;
}

/**
 * Lista los correos nuevos desde el UID guardado (o desde hace LOOKBACK días).
 * Devuelve también el UID más alto procesado para persistir el progreso.
 */
export async function fetchNewEmails(client: ImapFlow, lastUid: number | null, lookbackDays: number): Promise<{ emails: FetchedEmail[]; maxUid: number }> {
  const lock = await client.getMailboxLock("INBOX");
  try {
    let range: { uid: string };
    if (lastUid) {
      range = { uid: `${lastUid + 1}:*` };
    } else {
      const since = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000);
      // Algunos proveedores (Outlook) rechazan "since" sin "all" especificado
      const results = await client.search({ since, all: true }, { uid: true });
      const uids = Array.isArray(results) ? results : [];
      range = uids.length > 0 ? { uid: uids.join(",") } : { uid: "1:" };
    }

    const emails: FetchedEmail[] = [];
    let maxUid = lastUid || 0;

    // fetchAll: iterar por lotes fuera del "lock wait" para no bloquear el conexión
    const messages = client.fetch(range, { source: true, uid: true, flags: true });
    for await (const message of messages) {
      const msg = message as unknown as { uid: number; source: Buffer; flags?: Set<string> };
      if (msg.uid > maxUid) maxUid = msg.uid;
      try {
        const parsed = await parseEmail(msg.source);
        emails.push({ ...parsed, uid: msg.uid, seen: !!msg.flags?.has("\\Seen") });
      } catch (err) {
        console.error(`Error parseando email uid=${msg.uid}:`, err);
      }
    }

    return { emails, maxUid };
  } finally {
    lock.release();
  }
}

/**
 * UIDs de INBOX que ya están leídos en Gmail (desde minUid en adelante).
 */
export async function fetchSeenUids(client: ImapFlow, minUid: number): Promise<Set<number>> {
  const lock = await client.getMailboxLock("INBOX");
  try {
    const res = await client.search({ seen: true, uid: `${minUid}:*` }, { uid: true });
    return new Set(Array.isArray(res) ? res : []);
  } finally {
    lock.release();
  }
}

/** Correos que el propio CRM se manda (alertas de SLA): no deben convertirse en conversaciones. */
function isOwnAlert(email: FetchedEmail, ownAddress: string): boolean {
  const from = (email.fromEmail || "").toLowerCase();
  const subject = email.subject || "";
  return (
    from === ownAddress.toLowerCase() &&
    /conversaci[oó]n\(es\) sin responder|SLA excedido|ESCALADO/i.test(subject)
  );
}

export async function processEmails(emails: FetchedEmail[]) {
  await initPragmas();
  const cfg = await getConfig();
  for (const email of emails) {
    if (cfg.imapUser && isOwnAlert(email, cfg.imapUser)) continue;
    await processOne(email);
  }
}

async function processOne(email: FetchedEmail) {
  const { prisma } = await import("@/lib/prisma");
  const { findOrCreateByEmail } = await import("@/services/contacts/resolver");
  const { routeToConversation } = await import("@/services/conversations/router");
  const { slaEngine } = await import("@/services/sla/engine");

  const key = dedupKey(email);
  const existing = await prisma.message.count({
    where: { channel: "EMAIL", externalId: key },
  });
  if (existing > 0) return; // dedup

  const contact = await findOrCreateByEmail(email.fromEmail, email.fromName);
  const routed = await routeToConversation({
    contactId: contact.id,
    channel: "EMAIL",
    subject: email.subject,
    threadRef: email.rootMessageId,
    receivedAt: email.date,
    senderKey: email.fromEmail,
  });

  await prisma.message.create({
    data: {
      conversationId: routed.conversationId,
      channel: "EMAIL",
      externalId: key,
      direction: "INBOUND",
      sender: email.fromEmail,
      recipient: email.toEmail,
      subject: email.subject,
      body: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.date,
      meta: JSON.stringify({ uid: email.uid, references: email.references }),
    },
  });

  await slaEngine.onInbound(routed.conversationId, email.date);
  if (email.seen) {
    // Ya lo abriste en Gmail: queda como leído y no cuenta para el SLA.
    await prisma.conversation.update({ where: { id: routed.conversationId }, data: { status: "READ" } });
  }

  console.log(
    `📬 Email procesado: ${email.fromEmail} "${email.subject || ""}" → ${routed.isNew ? "NUEVA conversación" : "hilo existente"}`
  );
}