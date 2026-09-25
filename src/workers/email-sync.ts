import { initPragmas, prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { getConfig } from "@/lib/config";
import { connectImap, fetchNewEmails, processEmails } from "@/services/email/imap";

const env = getEnv();

async function getLastUid(): Promise<number | null> {
  const s = await prisma.setting.findUnique({ where: { key: "email.lastSyncUid" } });
  return s ? Number(s.value) || null : null;
}

async function setLastUid(uid: number) {
  await prisma.setting.upsert({
    where: { key: "email.lastSyncUid" },
    update: { value: String(uid) },
    create: { key: "email.lastSyncUid", value: String(uid) },
  });
}

async function markSeen(uids: number[]) {
  if (uids.length === 0) return;
  try {
    const client = await connectImap();
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd({ uid: uids.join(",") }, ["\\Seen"]);
      console.log(`📬 Marcados ${uids.length} emails como leídos.`);
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    console.error("No se pudo marcar como leído:", err);
  }
}

export async function runEmailSync(): Promise<{ processed: number; maxUid: number }> {
  await initPragmas();
  const cfg = await getConfig();
  if (!cfg.imapUser || !cfg.imapPassword) {
    console.log("📬 [email-sync] IMAP sin configurar, omitiendo sync.");
    return { processed: 0, maxUid: 0 };
  }

  let client;
  try {
    client = await connectImap();
    const lastUid = await getLastUid();
    const { emails, maxUid } = await fetchNewEmails(client, lastUid, cfg.imapLookbackDays);
    await client.logout();

    if (emails.length > 0) {
      await processEmails(emails);
      await setLastUid(maxUid);
      await markSeen(emails.map((e) => e.uid));
      console.log(`📬 Sync completo: ${emails.length} nuevos, último UID ${maxUid}.`);
    } else {
      console.log(`📬 Sync: sin emails nuevos (UID${lastUid ? ` > ${lastUid}` : ""}).`);
    }
    await prisma.setting.upsert({
      where: { key: "email.lastSyncAt" },
      update: { value: new Date().toISOString() },
      create: { key: "email.lastSyncAt", value: new Date().toISOString() },
    });
    return { processed: emails.length, maxUid };
  } catch (err) {
    console.error("Error en sync de email:", err);
    if (client && client.usable) {
      await client.logout().catch(() => {});
    }
    return { processed: 0, maxUid: 0 };
  }
}

// Worker en bucle (desarrollo local)
async function main() {
  await initPragmas();
  console.log(`📬 [email-sync] Worker iniciado (sync cada ${Math.round(env.imapSyncIntervalMs / 1000)}s).`);

  if (!env.imapUser || !env.imapPassword) {
    console.log("📬 [email-sync] AVISO: falta EMAIL_IMAP_USER/PASSWORD en .env. Esperando configuración...");
  }

  setInterval(() => {
    runEmailSync().catch((e) => console.error("Loop error:", e));
  }, env.imapSyncIntervalMs);

  // primer sync inmediato si hay configuración
  if (env.imapUser && env.imapPassword) {
    setTimeout(() => runEmailSync().catch(() => {}), 2000);
  }
}

// Solo arranca el loop cuando se ejecuta como script directa
// (no cuando se importa desde un cron serverless de Vercel).
const isMainModule =
  typeof require !== "undefined" && require.main === module;

if (isMainModule) {
  main().catch((e) => {
    console.error("Fallo fatal email-sync:", e);
    process.exit(1);
  });
}