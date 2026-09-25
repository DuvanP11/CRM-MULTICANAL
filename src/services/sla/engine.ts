import { prisma } from "@/lib/prisma";

/**
 * Motor SLA (lógica pura + persistencia).
 *
 * Reglas:
 * - Inbound entrante → conversación OPEN, lastIncomingAt = fecha del mensaje.
 * - Primera respuesta del agente (mensaje OUTBOUND con isAgentReply) →
 *   firstResponseAt = now, slaSeconds = now - lastIncomingAt, status = RESPONDED.
 * - Un inbound en una conversación ya respondida REABRE la ventana.
 * - Auto-replies y envíos no generados desde la UI NO cuentan para el SLA.
 */
export const slaEngine = {
  async onInbound(conversationId: string, receivedAt: Date) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: "OPEN",
        lastIncomingAt: receivedAt,
      },
    });
  },

  /**
   * Registra una respuesta del agente. Devuelve los datos del SLA si fue la
   * primera respuesta, o null si no.
   */
  async onAgentReply(conversationId: string, sentAt: Date = new Date()) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) return null;

    // Si ya había respuesta, no recalcular (SLA = primera respuesta)
    if (conv.firstResponseAt) {
      return null;
    }

    const lastIncoming = conv.lastIncomingAt;
    let slaSeconds: number | null = null;

    if (lastIncoming) {
      slaSeconds = Math.max(0, Math.round((sentAt.getTime() - lastIncoming.getTime()) / 1000));
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: "RESPONDED",
        firstResponseAt: sentAt,
      },
    });

    return { slaSeconds };
  },

  async markMessageAsFirstResponse(messageId: string, slaSeconds: number | null) {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        isAgentReply: true,
        isFirstResponse: slaSeconds != null,
        slaSeconds,
      },
    });
  },

  async markAgentReply(messageId: string) {
    await prisma.message.update({
      where: { id: messageId },
      data: { isAgentReply: true },
    });
  },

  /**
   * Conversaciones con SLA vencido (para el alert-worker).
   */
  async findBreached(thresholdMinutes: number, now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - thresholdMinutes * 60 * 1000);
    return prisma.conversation.findMany({
      where: {
        status: "OPEN",
        lastIncomingAt: { lt: cutoff },
      },
      include: { contact: true },
      orderBy: { lastIncomingAt: "asc" },
    });
  },

  minutesSince(conversation: { lastIncomingAt: Date | null }, now: Date = new Date()): number | null {
    if (!conversation.lastIncomingAt) return null;
    return Math.max(0, Math.floor((now.getTime() - conversation.lastIncomingAt.getTime()) / 60000));
  },

  formatDuration(seconds: number | null): string {
    if (seconds == null) return "—";
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m`;
  },
};