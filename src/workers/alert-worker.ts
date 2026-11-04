import { initPragmas, prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { getConfig } from "@/lib/config";
import { slaEngine } from "@/services/sla/engine";
import { sendEmail } from "@/services/email/smtp";
import { severityFor } from "@/services/alerts/meta";

const env = getEnv();

export async function checkAndFireAlerts(now: Date = new Date()): Promise<string[]> {
  await initPragmas();
  const cfg = await getConfig();
  const fired: string[] = [];
  const pendingEmail: {
    convId: string;
    contactLabel: string;
    subject: string;
    minutes: number;
    escalated: boolean;
  }[] = [];

  // Umbral global desde Setting (si está) o config/env
  const thresholdSetting = await prisma.setting.findUnique({
    where: { key: "sla.threshold.minutes" },
  });
  const thresholdMin = thresholdSetting ? Number(thresholdSetting.value) || cfg.slaThresholdMinutes : cfg.slaThresholdMinutes;

  const breached = await slaEngine.findBreached(thresholdMin, now);

  for (const conv of breached) {
    const convId = conv.id;
    const contactLabel = conv.contact.name || conv.contact.email || conv.contact.phone || "contacto";
    const subject = conv.subject || "sin asunto";
    const minutes = slaEngine.minutesSince(conv, now) ?? 0;

    // 1) Dashboard alert
    const dashExists = await prisma.alert.findFirst({
      where: { conversationId: convId, channel: "DASHBOARD", status: { in: ["PENDING", "SENT"] } },
    });
    if (!dashExists) {
      await prisma.alert.create({
        data: {
          conversationId: convId,
          channel: "DASHBOARD",
          status: "SENT",
          thresholdMin,
          triggeredAt: now,
          type: "SLA",
          severity: severityFor(false, minutes, thresholdMin),
        },
      });
      fired.push(`dashboard:${convId}`);
    }

    // 2) Email alert
    const emailExists = await prisma.alert.findFirst({
      where: { conversationId: convId, channel: "EMAIL", status: { in: ["PENDING", "SENT"] } },
    });
    if (!emailExists && cfg.alertEmailTo) {
      pendingEmail.push({ convId, contactLabel, subject, minutes, escalated: false });
    }

    // 3) Telegram alert
    const tgExists = await prisma.alert.findFirst({
      where: { conversationId: convId, channel: "TELEGRAM", status: { in: ["PENDING", "SENT"] } },
    });
    if (!tgExists && cfg.telegramBotToken && cfg.telegramChatId) {
      try {
        const sent = await sendTelegram(
          `⏰ <b>SLA excedido</b>\n<b>Contacto:</b> ${contactLabel}\n<b>Tema:</b> ${subject}\n<b>Tiempo sin responder:</b> ${minutes} min (umbral ${thresholdMin})\n<a href="${process.env.NEXTAUTH_URL}/conversations/${convId}">Abrir conversación</a>`
        );
        if (sent) {
          await prisma.alert.create({
            data: {
              conversationId: convId,
              channel: "TELEGRAM",
              status: "SENT",
              thresholdMin,
              triggeredAt: now,
              type: "SLA",
              severity: severityFor(false, minutes, thresholdMin),
            },
          });
          fired.push(`telegram:${convId}`);
        }
      } catch (err) {
        console.error("Fallo enviando alerta por Telegram:", err);
      }
    }

    // 4) Escalamiento: 2x umbral ya superado
    if (minutes >= thresholdMin * 2) {
      const escalatedEmail = await prisma.alert.findFirst({
        where: { conversationId: convId, channel: "EMAIL", escalated: true },
      });
      if (!escalatedEmail && cfg.alertEmailTo) {
        pendingEmail.push({ convId, contactLabel, subject, minutes, escalated: true });
      }
    }
  }

  // Un solo correo resumen por pasada (evita el bloqueo de Gmail por demasiados logins)
  if (pendingEmail.length > 0 && cfg.alertEmailTo) {
    const backoff = await prisma.setting.findUnique({ where: { key: "alerts.emailBackoffUntil" } });
    const blocked = backoff && Number(backoff.value) > now.getTime();
    if (!blocked) {
      const base = process.env.NEXTAUTH_URL;
      const lines = pendingEmail
        .slice(0, 50)
        .map(
          (p) =>
            `${p.escalated ? "🚨 ESCALADO" : "⏰"} ${p.contactLabel} (${p.subject}) — ${p.minutes} min sin respuesta\n${base}/conversations/${p.convId}`
        )
        .join("\n\n");
      try {
        await sendEmail({
          to: cfg.alertEmailTo,
          subject: `⏰ ${pendingEmail.length} conversación(es) sin responder (umbral ${thresholdMin} min)`,
          text: `${lines}${pendingEmail.length > 50 ? `\n\n… y ${pendingEmail.length - 50} más.` : ""}`,
        });
        for (const p of pendingEmail) {
          await prisma.alert.create({
            data: {
              conversationId: p.convId,
              channel: "EMAIL",
              status: "SENT",
              thresholdMin,
              triggeredAt: now,
              escalated: p.escalated,
              type: p.escalated ? "ESCALATION" : "SLA",
              severity: p.escalated ? "CRITICAL" : severityFor(false, p.minutes, thresholdMin),
            },
          });
          fired.push(`${p.escalated ? "escalated" : "email"}:${p.convId}`);
        }
      } catch (err) {
        console.error("Fallo enviando resumen de alertas por email:", err);
        const until = String(now.getTime() + 30 * 60 * 1000);
        await prisma.setting.upsert({
          where: { key: "alerts.emailBackoffUntil" },
          update: { value: until },
          create: { key: "alerts.emailBackoffUntil", value: until },
        });
      }
    }
  }

  return fired;
}

export async function sendTelegram(text: string): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg.telegramBotToken || !cfg.telegramChatId) {
    throw new Error("Telegram no configurado");
  }
  const url = `https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cfg.telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Telegram error ${res.status}: ${data?.description || "desconocido"}`);
  }
  return data?.ok === true;
}

async function main() {
  await initPragmas();
  console.log(`🔔 [alert-worker] Worker iniciado (revisión cada ${Math.round(env.alertCheckIntervalMs / 1000)}s). Umbral SLA: ${env.slaThresholdMinutes} min.`);

  setInterval(async () => {
    try {
      const fired = await checkAndFireAlerts();
      if (fired.length > 0) {
        console.log(`🔔 Alertas disparadas: ${fired.join(", ")}`);
      }
    } catch (e) {
      console.error("Error en ciclo de alertas:", e);
    }
  }, env.alertCheckIntervalMs);

  // primera pasada inmediata
  setTimeout(async () => {
    try {
      const fired = await checkAndFireAlerts();
      if (fired.length > 0) console.log(`🔔 Alertas iniciales: ${fired.join(", ")}`);
      else console.log("🔔 Revisión inicial: sin conversaciones vencidas.");
    } catch (e) {
      console.error("Error en revisión inicial:", e);
    }
  }, 3000);
}

// Solo arranca el loop cuando se ejecuta como script directa
// (no cuando se importa desde un cron serverless de Vercel).
const isMainModule =
  typeof require !== "undefined" && require.main === module;

if (isMainModule) {
  main().catch((e) => {
    console.error("Fallo fatal alert-worker:", e);
    process.exit(1);
  });
}