import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";
import {
  BRAND_LOGO_MAX_LENGTH,
  BRAND_NAME_MAX,
  isValidHex,
  isValidLogo,
  normalizeHex,
} from "@/lib/brand";

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
    const name = body.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, BRAND_NAME_MAX);
    await setSetting("brand.name", name || null);
    updated.push("name");
  }

  if (typeof body.logo === "string") {
    const logo = body.logo.trim();
    if (logo !== "" && !isValidLogo(logo)) {
      return NextResponse.json(
        { error: "Logo inválido: sube una imagen o pega una URL http(s)" },
        { status: 400 }
      );
    }
    if (logo.length > BRAND_LOGO_MAX_LENGTH) {
      return NextResponse.json({ error: "Logo demasiado grande (máx 1.5 MB)" }, { status: 400 });
    }
    await setSetting("brand.logo", logo || null);
    updated.push("logo");
  }

  for (const key of ["primary", "accent"] as const) {
    if (typeof body[key] !== "string") continue;
    const value = (body[key] as string).trim();
    if (!isValidHex(value)) {
      return NextResponse.json(
        { error: `Color ${key} inválido: usa un hexadecimal como #1d4ed8` },
        { status: 400 }
      );
    }
    await setSetting(`brand.${key}`, normalizeHex(value));
    updated.push(key);
  }

  if (updated.length === 0) {
    return NextResponse.json({ error: "No hay campos válidos" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated });
}
