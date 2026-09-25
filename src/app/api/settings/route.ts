import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, initPragmas } from "@/lib/prisma";
import { getConfigModel, saveConfig } from "@/lib/config";
import { getConfig } from "@/lib/config";
import { createTransport } from "@/services/email/smtp";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await initPragmas();
  return NextResponse.json(await getConfigModel());
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await initPragmas();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const actions: { ok: boolean; test?: string; error?: string }[] = [];

  // --- Umbral de SLA (sigue guardándose como setting independiente) ---
  if (typeof body.slaThresholdMinutes === "number") {
    const value = Math.min(720, Math.max(1, Math.round(body.slaThresholdMinutes)));
    await prisma.setting.upsert({
      where: { key: "sla.threshold.minutes" },
      update: { value: String(value) },
      create: { key: "sla.threshold.minutes", value: String(value) },
    });
    actions.push({ ok: true, test: `Umbral SLA actualizado a ${value} min` });
  }

  // --- Guardar credenciales desde la web (cfg.*) ---
  if (body.config && typeof body.config === "object") {
    const saved = await saveConfig(body.config as Record<string, string>);
    if (saved.length > 0) {
      actions.push({ ok: true, test: `Configuración guardada (${saved.length} campos)` });
    }
  }

  const cfg = await getConfig();

  // --- Pruebas de conexión (usan la configuración efectiva: web > .env) ---
  if (body.test === "imap") {
    try {
      if (!cfg.imapUser || !cfg.imapPassword) {
        actions.push({ ok: false, test: "IMAP", error: "Completa primero los datos de correo (IMAP)" });
      } else {
        const { connectImap } = await import("@/services/email/imap");
        const client = await connectImap();
        const lock = await client.getMailboxLock("INBOX");
        const exists = client.mailbox && "exists" in client.mailbox ? client.mailbox.exists : 0;
        await lock.release();
        await client.logout();
        actions.push({ ok: true, test: `IMAP: conexión exitosa (${exists} mensajes en INBOX)` });
      }
    } catch (err) {
      actions.push({ ok: false, test: "IMAP", error: err instanceof Error ? err.message : "Error" });
    }
  }

  if (body.test === "smtp") {
    try {
      if (!cfg.smtpUser || !cfg.smtpPassword) {
        actions.push({ ok: false, test: "SMTP", error: "Completa primero los datos de correo (SMTP)" });
      } else {
        const transport = createTransport(cfg);
        await transport.verify();
        actions.push({ ok: true, test: "SMTP: conexión exitosa" });
      }
    } catch (err) {
      actions.push({ ok: false, test: "SMTP", error: err instanceof Error ? err.message : "Error" });
    }
  }

  if (body.test === "whatsapp") {
    try {
      if (!cfg.waPhoneNumberId || !cfg.waAccessToken) {
        actions.push({ ok: false, test: "WhatsApp", error: "Completa primero los datos de WhatsApp" });
      } else {
        const url = `https://graph.facebook.com/${cfg.waGraphVersion}/${cfg.waPhoneNumberId}?fields=id,display_phone_number,verified_name`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${cfg.waAccessToken}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = data?.error?.message || `HTTP ${res.status}`;
          if (detail.includes("(#100)") || detail.includes("invalid")) {
            actions.push({
              ok: false,
              test: "WhatsApp",
              error: `Token o ID inválido (${detail}). Verifica el token y el ID del número.`,
            });
          } else {
            actions.push({ ok: false, test: "WhatsApp", error: detail });
          }
        } else {
          const label = data?.verified_name || data?.display_phone_number || "número";
          actions.push({ ok: true, test: `WhatsApp: conexión exitosa (${label})` });
        }
      }
    } catch (err) {
      actions.push({
        ok: false,
        test: "WhatsApp",
        error: err instanceof Error ? err.message : "Error de red",
      });
    }
  }

  if (body.test === "telegram") {
    try {
      const { sendTelegram } = await import("@/workers/alert-worker");
      await sendTelegram("✅ <b>CRM-WA</b>\nConexión con Telegram correcta.");
      actions.push({ ok: true, test: "Telegram: mensaje enviado" });
    } catch (err) {
      actions.push({ ok: false, test: "Telegram", error: err instanceof Error ? err.message : "Error" });
    }
  }

  return NextResponse.json({ actions });
}