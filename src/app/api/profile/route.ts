import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";

const MAX_AVATAR_LENGTH = 1_500_000;

async function setSetting(key: string, value: string | null) {
  if (value == null || value === "") {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
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

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    await setSetting("profile.name", name || null);
    updated.push("name");
  }

  if (typeof body.avatar === "string") {
    const avatar = body.avatar.trim();
    const valid =
      avatar === "" ||
      /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(avatar) ||
      /^https?:\/\//i.test(avatar);
    if (!valid) {
      return NextResponse.json({ error: "Avatar inválido: usa una imagen o una URL http(s)" }, { status: 400 });
    }
    if (avatar.length > MAX_AVATAR_LENGTH) {
      return NextResponse.json({ error: "Avatar demasiado grande" }, { status: 400 });
    }
    await setSetting("profile.avatar", avatar || null);
    updated.push("avatar");
  }

  if (updated.length === 0) {
    return NextResponse.json({ error: "No hay campos válidos" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated });
}