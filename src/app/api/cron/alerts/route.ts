import { NextRequest, NextResponse } from "next/server";
import { checkAndFireAlerts } from "@/workers/alert-worker";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fired = await checkAndFireAlerts();
  return NextResponse.json({ ok: true, fired });
}