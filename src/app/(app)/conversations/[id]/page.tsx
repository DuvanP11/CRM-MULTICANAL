import { notFound } from "next/navigation";
import { initPragmas, prisma } from "@/lib/prisma";
import ChannelBadge from "@/components/channel-badge";
import ChannelLogo from "@/components/channel-logo";
import ReplyBox from "./reply-box";

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await initPragmas();

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      messages: { orderBy: { receivedAt: "asc" } },
      alerts: { orderBy: { triggeredAt: "desc" } },
    },
  });

  if (!conversation) notFound();

  const contactName = conversation.contact.name || conversation.contact.email || conversation.contact.phone;
  const pendingAlerts = conversation.alerts.filter((a) => a.status !== "ACKED").length;

  return (
    <div style={{ maxWidth: 720 }}>
      <a href="/conversations" style={{ fontSize: 14, color: "var(--on-surface)" }}>
        ← Volver a conversaciones
      </a>

      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChannelLogo channel={conversation.channel} size={22} />
          <h1 style={{ fontSize: 22 }}>{contactName}</h1>
          <ChannelBadge channel={conversation.channel} />
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
          {conversation.subject && `${conversation.subject} · `}
          <span style={{ fontWeight: 600 }}>{conversation.status}</span>
        </p>
      </div>

      {pendingAlerts > 0 && (
        <div
          style={{
            background: "#dc26261a",
            border: "1px solid #dc2626",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--danger)",
            marginBottom: 20,
          }}
        >
          ⚠ {pendingAlerts} alerta(s) pendiente(s) de respuesta
        </div>
      )}

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {conversation.messages.map((m) => {
          const isOutbound = m.direction === "OUTBOUND";
          const isFailed = (() => {
            try {
              const meta = m.meta ? JSON.parse(m.meta) : null;
              return meta?.error;
            } catch {
              return null;
            }
          })();

          return (
            <div
              key={m.id}
              style={{
                alignSelf: isOutbound ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: isOutbound ? "var(--primary)" : "var(--incoming-bg)",
                color: isOutbound ? "#fff" : "var(--foreground)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                {isFailed ? (
                  <span>⚠️ Envío fallido</span>
                ) : isOutbound ? (
                  <span>Tú</span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ChannelLogo channel={m.channel} size={11} />
                    {m.channel === "WHATSAPP" ? "WhatsApp" : m.channel === "TELEGRAM" ? "Telegram" : "Email"}
                  </span>
                )}
                <span>· {new Date(m.receivedAt).toLocaleString()}</span>
                {m.slaSeconds != null && m.isFirstResponse && (
                  <span style={{ fontWeight: 700 }}>
                    · primera respuesta en {formatDuration(m.slaSeconds)}
                  </span>
                )}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          );
        })}
      </div>

      <ReplyBox conversationId={conversation.id} channel={conversation.channel} />
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}