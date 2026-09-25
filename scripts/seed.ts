import bcrypt from "bcryptjs";
import { prisma, initPragmas } from "../src/lib/prisma";
import { getEnv } from "../src/lib/env";

async function seedAdmin() {
  const env = getEnv();
  const email = env.adminEmail || "admin@crm.local";

  // Si no hay hash configurado, pedimos/generamos una contraseña por defecto
  let hashB64 = env.adminPasswordHashB64;
  if (!hashB64) {
    const defaultPassword = "admin1234";
    console.log(`\n⚠️  No hay ADMIN_PASSWORD_HASH_B64 configurado.`);
    console.log(`    Se usará la contraseña temporal: ${defaultPassword}`);
    console.log(`    Cámbiala tras el primer acceso en /settings.\n`);
    hashB64 = Buffer.from(bcrypt.hashSync(defaultPassword, 12)).toString("base64");
  }

  await prisma.setting.upsert({
    where: { key: "auth.admin.email" },
    update: { value: email },
    create: { key: "auth.admin.email", value: email },
  });
  await prisma.setting.upsert({
    where: { key: "auth.admin.passwordHash" },
    update: { value: hashB64 },
    create: { key: "auth.admin.passwordHash", value: hashB64 },
  });

  console.log(`✔ Admin configurado: ${email}`);
}

async function seedDemo() {
  const count = await prisma.conversation.count();
  if (count > 0) {
    console.log("✔ Ya hay datos en la BD, se omite el seed demo.");
    return;
  }

  const contact1 = await prisma.contact.create({
    data: { name: "María López", email: "maria.lopez@example.com" },
  });
  const contact2 = await prisma.contact.create({
    data: { name: "Carlos Gómez", phone: "+5215512345678" },
  });

  const now = new Date();

  // Conversación de email cobrada (SLA breach)
  await prisma.conversation.create({
    data: {
      contactId: contact1.id,
      subject: "Presupuesto para mi tienda",
      channel: "EMAIL",
      status: "OPEN",
      lastIncomingAt: new Date(now.getTime() - 45 * 60 * 1000),
      messages: {
        create: {
          channel: "EMAIL",
          externalId: "demo-email-1",
          direction: "INBOUND",
          sender: contact1.email!,
          subject: "Presupuesto para mi tienda",
          body: "¡Hola! Quisiera un presupuesto para mi tienda online, ¿me pueden ayudar?",
          receivedAt: new Date(now.getTime() - 45 * 60 * 1000),
        },
      },
    },
  });

  // Conversación WhatsApp respondida (SLA ok)
  const conv2 = await prisma.conversation.create({
    data: {
      contactId: contact2.id,
      channel: "WHATSAPP",
      status: "RESPONDED",
      lastIncomingAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      firstResponseAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            channel: "WHATSAPP",
            externalId: "demo-wa-in",
            direction: "INBOUND",
            sender: "+5215512345678",
            body: "Hola, ¿tienen disponibilidad para mañana?",
            receivedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          },
          {
            channel: "WHATSAPP",
            externalId: "demo-wa-out",
            direction: "OUTBOUND",
            sender: "+5215512345678",
            body: "¡Hola Carlos! Sí, mañana a las 10am tenemos cupo. ¿Te reservo?",
            receivedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            isAgentReply: true,
            isFirstResponse: true,
          },
        ],
      },
    },
  });

  await prisma.alert.create({
    data: {
      conversationId: conv2.id,
      channel: "EMAIL",
      status: "SENT",
      thresholdMin: 30,
      triggeredAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  });

  console.log("✔ Seed demo creado (2 contactos, 2 conversaciones).");
}

async function main() {
  await initPragmas();
  await seedAdmin();
  await seedDemo();
  console.log("✔ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });