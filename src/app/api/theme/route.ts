import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";
import { isValidPalette } from "@/lib/themes";

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await initPragmas();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const updated: string[] = [];

  if (typeof body.palette === "string") {
    if (!isValidPalette(body.palette)) {
      return NextResponse.json({ error: "Paleta inválida" }, { status: 400 });
    }
    await setSetting("theme.palette", body.palette);
    updated.push("palette");
  }

  if (typeof body.mode === "string") {
    if (body.mode !== "light" && body.mode !== "dark") {
      return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
    }
    await setSetting("theme.mode", body.mode);
    updated.push("mode");
  }

  if (updated.length === 0) {
    return NextResponse.json({ error: "No hay campos válidos" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated });
}