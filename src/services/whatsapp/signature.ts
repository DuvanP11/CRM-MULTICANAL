import crypto from "crypto";
import { getConfig } from "@/lib/config";

/**
 * Verifica la firma X-Hub-Signature-256 de Meta.
 * IMPORTANTE: debe recibir el body CRUDO (rawBuffer), no el JSON re-serializado,
 * porque la firma cubre los bytes exactos de la petición.
 */
export async function verifyWhatsAppSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null
): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg.waAppSecret) return false;

  const appSecret = cfg.waAppSecret;
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");

  if (!signatureHeader) return false;

  const provided = signatureHeader.trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}