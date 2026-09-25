import { NextRequest, NextResponse } from "next/server";
import { runEmailSync } from "@/workers/email-sync";

/**
 * Cron serverless (Vercel) para sincronizar email.
 * Se protege con el header CRON_SECRET si está configurado.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await runEmailSync();
  return NextResponse.json({ ok: true, ...result });
}