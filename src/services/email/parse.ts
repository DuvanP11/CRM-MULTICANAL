import crypto from "crypto";
import { simpleParser, type AddressObject } from "mailparser";
import { extractRootMessageId } from "@/services/conversations/router";

function extractAddress(address?: AddressObject | AddressObject[] | { value: unknown[] }): string | null {
  if (!address) return null;
  const value = Array.isArray(address) ? address[0]?.value : "value" in address ? (address as { value: { address?: string }[] }).value : null;
  const first = Array.isArray(value) ? value[0] : null;
  if (first && "address" in first && typeof (first as { address: string }).address === "string") {
    return (first as { address: string }).address.toLowerCase();
  }
  return null;
}

function extractName(address?: AddressObject | AddressObject[] | { value: unknown[] }): string | null {
  if (!address) return null;
  const value = Array.isArray(address) ? address[0]?.value : "value" in address ? (address as { value: { name?: string }[] }).value : null;
  const first = Array.isArray(value) ? value[0] : null;
  if (first && typeof (first as { name?: string }).name === "string") {
    return (first as { name: string }).name || null;
  }
  return null;
}

export interface ParsedEmail {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  references: string | null;
  inReplyTo: string | null;
  rootMessageId: string | null;
  date: Date;
  raw: string;
}

export async function parseEmail(raw: Buffer | string): Promise<ParsedEmail> {
  const parsed = await simpleParser(raw);

  const fromEmail = extractAddress(parsed.from) || "";
  const fromName = extractName(parsed.from) || null;
  const toEmail = extractAddress(parsed.to) || null;

  // simpleParser ya convierte text/plain; html es texto plano renderizado
  const bodyText = (parsed.text || "").trim();
  const bodyHtml =
    parsed.html && typeof parsed.html === "string"
      ? parsed.html
      : Buffer.isBuffer(parsed.html)
        ? parsed.html.toString()
        : null;

  const messageId = parsed.messageId || "";
  const references = parsed.references ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : parsed.references) : null;
  const inReplyTo = parsed.inReplyTo || null;

  return {
    messageId,
    fromEmail,
    fromName,
    toEmail,
    subject: parsed.subject || null,
    bodyText: bodyText || "(sin contenido)",
    bodyHtml,
    references,
    inReplyTo,
    rootMessageId: extractRootMessageId(references, inReplyTo),
    date: parsed.date || new Date(),
    raw: typeof raw === "string" ? raw : raw.toString("utf8"),
  };
}

/**
 * Falla al Message-ID o a un hash estable cuando no existe.
 * El dedup usa este valor en Message.externalId.
 */
export function dedupKey(parsed: ParsedEmail): string {
  if (parsed.messageId) return parsed.messageId;
  const hash = crypto
    .createHash("sha256")
    .update(
      `${parsed.fromEmail}|${parsed.subject || ""}|${parsed.date.toISOString()}`
    )
    .digest("hex")
    .slice(0, 40);
  return `hash:${hash}`;
}