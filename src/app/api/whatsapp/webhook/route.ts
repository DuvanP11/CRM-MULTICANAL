import { NextRequest, NextResponse } from "next/server";
import { verifyWhatsAppSignature } from "@/services/whatsapp/signature";
import { processWebhookPayload } from "@/services/whatsapp/webhook-handler";
import { getConfig } from "@/lib/config";

/**
 * GET: handshake de verificación de Meta. Responde hub.challenge
 * si hub.verify_token coincide con WA_WEBHOOK_VERIFY_TOKEN.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cfg = await getConfig();
  const params = request.nextUrl.searchParams;

  const mode = params.get("hub.mode");
  const verifyToken = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === cfg.waWebhookVerifyToken && verifyToken) {
    console.log("✅ Webhook de WhatsApp verificado por Meta.");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Verificación fallida", { status: 403 });
}

/**
 * POST: mensajes entrantes de WhatsApp. La firma se valida SIEMPRE sobre el body crudo.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  const verified = await verifyWhatsAppSignature(rawBody, signature);

  if (!verified) {
    console.warn("⚠️ Webhook de WhatsApp con firma inválida (posible ataque de replays).");
    return new NextResponse("Firma inválida", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const { processed } = await processWebhookPayload(payload);
    console.log(`✅ Webhook procesado: ${processed} mensaje(s).`);
    return NextResponse.json({ received: true, processed }, { status: 200 });
  } catch (error) {
    console.error("Error procesando webhook de WhatsApp:", error);
    // Meta reintenta con backoff; respondemos 200 para no generar loop infinito
    // si el error es de nuestro lado después de validar la firma
    return NextResponse.json({ received: true }, { status: 200 });
  }
}