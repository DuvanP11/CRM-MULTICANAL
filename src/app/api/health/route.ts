import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await initPragmas();

  const lastSync = await prisma.setting.findUnique({ where: { key: "email.lastSyncUid" } });
  const lastSyncRun = await prisma.setting.findUnique({ where: { key: "email.lastSyncAt" } });
  const openConvs = await prisma.conversation.count({ where: { status: "OPEN" } });
  const messageCount = await prisma.message.count();

  return NextResponse.json({
    ok: true,
    db: "connected",
    lastSyncUid: lastSync?.value || null,
    lastSyncAt: lastSyncRun?.value || null,
    openConversations: openConvs,
    messages: messageCount,
    time: new Date().toISOString(),
  });
}