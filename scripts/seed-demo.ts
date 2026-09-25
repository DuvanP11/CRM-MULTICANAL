import { prisma, initPragmas } from "../src/lib/prisma";
import { getConfig } from "../src/lib/config";

/**
 * Seed DE DEMOSTRACIÓN: crea clientes, conversaciones (correo y WhatsApp)
 * con distintos estados de SLA y alertas, para que la vista del CRM se
 * vea con contenido real sin esperar tráfico.
 *
 * Solo se ejecuta manualmente (npm run demo). No toca datos reales:
 * borra únicamente lo que el propio seed demo creó antes (prefijo demo-).
 */

const H = 3600 * 1000;
const M = 60 * 1000;

async function resetDemo() {
  const convs = await prisma.conversation.findMany({
    where: { messages: { some: { externalId: { startsWith: "demo-" } } } },
    select: { id: true, contactId: true },
  });
  if (convs.length === 0) return 0;
  await prisma.alert.deleteMany({ where: { conversationId: { in: convs.map((c) => c.id) } } });
  await prisma.message.deleteMany({ where: { conversationId: { in: convs.map((c) => c.id) } } });
  await prisma.conversation.deleteMany({ where: { id: { in: convs.map((c) => c.id) } } });
  await prisma.contact.deleteMany({
    where: { id: { in: convs.map((c) => c.contactId) } },
  });
  return convs.length;
}

type ConvInput = {
  contact: { name: string; email?: string; phone?: string };
  channel: "EMAIL" | "WHATSAPP";
  subject?: string;
  status: "OPEN" | "RESPONDED";
  inbound: { body: string; receivedMinutesAgo: number };
  reply?: { body: string; replyDelayMinutes: number } | null;
  alerts?: { channel: string; status: string; escalated?: boolean; minutesAfterInbound: number }[];
};

const DEMO_CONVS: ConvInput[] = [
  // 1) Correo — SLA vencido y ESCALADO (crítico)
  {
    contact: { name: "María López", email: "maria.lopez@demo.test" },
    channel: "EMAIL",
    subject: "Presupuesto para mi tienda online",
    status: "OPEN",
    inbound: { body: "¡Hola! Quisiera un presupuesto para mi tienda online, me llegó el dato por un amigo. ¿Me pueden ayudar hoy?", receivedMinutesAgo: 95 },
    alerts: [
      { channel: "DASHBOARD", status: "SENT", escalated: true, minutesAfterInbound: 80 },
      { channel: "EMAIL", status: "SENT", escalated: true, minutesAfterInbound: 80 },
    ],
  },
  // 2) WhatsApp — respondido dentro del SLA (buen tiempo)
  {
    contact: { name: "Carlos Gómez", phone: "+573001234567" },
    channel: "WHATSAPP",
    subject: "Disponibilidad para mañana",
    status: "RESPONDED",
    inbound: { body: "Hola, ¿tienen disponibilidad para mañana en la mañana?", receivedMinutesAgo: 180 },
    reply: { body: "¡Hola Carlos! Sí, mañana a las 10am tenemos cupo. ¿Te reservo?", replyDelayMinutes: 55 },
    alerts: [{ channel: "EMAIL", status: "ACKED", minutesAfterInbound: 30 }],
  },
  // 3) Correo — respondido muy rápido
  {
    contact: { name: "Ana Torres", email: "ana.torres@demo.test" },
    channel: "EMAIL",
    subject: "Solicitud de facturación",
    status: "RESPONDED",
    inbound: { body: "Buenos días, necesito la factura del mes pasado con su NIT y datos de envío. Gracias.", receivedMinutesAgo: 480 },
    reply: { body: "¡Hola Ana! Claro, adjunto la factura de tu último servicio.", replyDelayMinutes: 6 },
  },
  // 4) WhatsApp — SLA vencido sin responder (urgente)
  {
    contact: { name: "Jorge Ramírez", phone: "+573009876543" },
    channel: "WHATSAPP",
    subject: "Reclamo por envío atrasado",
    status: "OPEN",
    inbound: { body: "Llevo 4 días esperando mi pedido y nadie me responde. Necesito una solución ya.", receivedMinutesAgo: 52 },
    alerts: [{ channel: "DASHBOARD", status: "SENT", minutesAfterInbound: 40 }],
  },
  // 5) Correo — abierta pero reciente (dentro del SLA, pendiente)
  {
    contact: { name: "Laura Fernández", email: "laura.fernandez@demo.test" },
    channel: "EMAIL",
    subject: "Cotización de servicio corporativo",
    status: "OPEN",
    inbound: { body: "Hola, me interesaría una cotización para un plan corporativo de 12 personas. ¿Me pueden compartir condiciones?", receivedMinutesAgo: 8 },
  },
  // 6) WhatsApp — reabierta con nuevo mensaje (contexto)
  {
    contact: { name: "Pedro Silva", phone: "+573011223344" },
    channel: "WHATSAPP",
    subject: "Seguimiento pedido #4821",
    status: "OPEN",
    inbound: { body: "Hola, solo escribo para confirmar que mi pedido llegó bien. ¡Excelente servicio! ¿Podrían enviar la garantía por este medio?", receivedMinutesAgo: 14 },
    alerts: [{ channel: "EMAIL", status: "ACKED", minutesAfterInbound: 20 }],
  },
  // 7) Correo — respondido (histórico, suma al promedio)
  {
    contact: { name: "Valentina Ríos", email: "valentina.rios@demo.test" },
    channel: "EMAIL",
    subject: "Cambio de fecha de entrega",
    status: "RESPONDED",
    inbound: { body: "Necesito cambiar la fecha de entrega del servicio contratado, ¿es posible esta semana?", receivedMinutesAgo: 2640 },
    reply: { body: "¡Hola Valentina! Claro, reasignamos la entrega para el jueves.", replyDelayMinutes: 28 },
  },
  // 8) WhatsApp — respondido en corto (suma al promedio)
  {
    contact: { name: "Diego Hurtado", phone: "+573014455667" },
    channel: "WHATSAPP",
    subject: "Consulta de precios",
    status: "RESPONDED",
    inbound: { body: "Hola, ¿me pueden pasar precios del plan mensual?", receivedMinutesAgo: 1320 },
    reply: { body: "¡Hola Diego! Claro, te comparto el listado de precios en un momento.", replyDelayMinutes: 12 },
  },
  // 9) Correo — correo masivo tipo notificación (ruido, SLA normal)
  {
    contact: { name: "Nora Peña", email: "nora.pena@demo.test" },
    channel: "EMAIL",
    subject: "Confirmación de pago recibido",
    status: "RESPONDED",
    inbound: { body: "Adjunto comprobante de transferencia por el valor acordado. Confirmen por favor la recepción.", receivedMinutesAgo: 870 },
    reply: { body: "¡Hola Nora! Confirmamos la recepción del pago. Su servicio queda activado.", replyDelayMinutes: 18 },
  },
];

async function seedDemoConv(input: ConvInput, thresholdMin: number) {
  const contact = await prisma.contact.create({
    data: {
      name: input.contact.name,
      email: input.contact.email,
      phone: input.contact.phone,
    },
  });

  const now = new Date();
  const inboundAt = new Date(now.getTime() - input.inbound.receivedMinutesAgo * M);

  const msgs: {
    channel: string;
    externalId: string;
    direction: string;
    sender: string;
    recipient?: string;
    subject?: string;
    body: string;
    receivedAt: Date;
    sentAt?: Date;
    isAgentReply?: boolean;
    isFirstResponse?: boolean;
    slaSeconds?: number;
  }[] = [
    {
      channel: input.channel,
      externalId: `demo-${contact.id}-in`,
      direction: "INBOUND",
      sender: input.contact.email || input.contact.phone || "",
      recipient: input.contact.email ? "negocio@crm.local" : undefined,
      subject: input.subject,
      body: input.inbound.body,
      receivedAt: inboundAt,
    },
  ];

  let firstResponseAt: Date | null = null;
  if (input.reply) {
    const replyAt = new Date(inboundAt.getTime() + input.reply.replyDelayMinutes * M);
    const slaSeconds = Math.round((replyAt.getTime() - inboundAt.getTime()) / 1000);
    firstResponseAt = replyAt;
    msgs.push({
      channel: input.channel,
      externalId: `demo-${contact.id}-out`,
      direction: "OUTBOUND",
      sender: input.contact.email ? "negocio@crm.local" : input.contact.phone || "",
      recipient: input.contact.email || input.contact.phone,
      subject: input.subject ? `Re: ${input.subject}` : undefined,
      body: input.reply.body,
      receivedAt: replyAt,
      sentAt: replyAt,
      isAgentReply: true,
      isFirstResponse: true,
      slaSeconds,
    });
  }

  const conv = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      subject: input.subject,
      channel: input.channel,
      status: input.status,
      lastIncomingAt: inboundAt,
      firstResponseAt,
      messages: { create: msgs },
    },
  });

  for (const a of input.alerts || []) {
    const escalated = a.escalated ?? false;
    const minutes = a.minutesAfterInbound;
    await prisma.alert.create({
      data: {
        conversationId: conv.id,
        channel: a.channel,
        status: a.status,
        thresholdMin,
        escalated,
        type: escalated ? "ESCALATION" : "SLA",
        severity: escalated || minutes >= thresholdMin * 2 ? "CRITICAL" : "WARNING",
        triggeredAt: new Date(inboundAt.getTime() + minutes * M),
      },
    });
  }
}

async function main() {
  await initPragmas();
  const cfg = await getConfig();
  const thresholdMin = cfg.slaThresholdMinutes || 30;

  const removed = await resetDemo();
  console.log(`🧹 Datos demo anteriores eliminados (${removed} conversaciones).`);

  for (const conv of DEMO_CONVS) {
    await seedDemoConv(conv, thresholdMin);
  }

  const [contacts, conversations, alerts] = await Promise.all([
    prisma.contact.count(),
    prisma.conversation.count(),
    prisma.alert.count(),
  ]);

  console.log(`✔ Demo cargada: ${contacts} clientes, ${conversations} conversaciones, ${alerts} alertas.`);
  console.log(`  Umbral SLA actual: ${thresholdMin} min.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });