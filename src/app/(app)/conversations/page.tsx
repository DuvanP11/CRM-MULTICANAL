import { initPragmas, prisma } from "@/lib/prisma";
import ChannelBadge from "@/components/channel-badge";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: { channel?: string; status?: string };
}) {
  await initPragmas();

  const channel = searchParams.channel;
  const status = searchParams.status;

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    },
    include: { contact: true, messages: { orderBy: { receivedAt: "desc" }, take: 1 } },
    orderBy: { lastIncomingAt: "desc" },
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Conversaciones</h1>

      <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <FilterChip label="Todas" href="/conversations" active={!channel && !status}>
          {logo("ALL")}
        </FilterChip>
        <FilterChip label="Email" href="/conversations?channel=EMAIL" active={channel === "EMAIL"}>
          {logo("EMAIL")}
        </FilterChip>
        <FilterChip label="WhatsApp" href="/conversations?channel=WHATSAPP" active={channel === "WHATSAPP"}>
          {logo("WHATSAPP")}
        </FilterChip>
        <FilterChip label="Sin responder" href="/conversations?status=OPEN" active={status === "OPEN"}>
          {logo("ALL")}
        </FilterChip>
      </div>

      {conversations.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No hay conversaciones todavía.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {conversations.map((c) => {
          const last = c.messages[0];
          return (
            <a
              key={c.id}
              href={`/conversations/${c.id}`}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "block",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 15 }}>
                    {c.contact.name || c.contact.email || c.contact.phone || "Anónimo"}
                  </strong>
                  {c.subject && (
                    <span style={{ color: "var(--muted)", fontSize: 14, marginLeft: 8 }}>
                      · {c.subject}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge status={c.status} />
                  <ChannelBadge channel={c.channel} />
                </div>
              </div>
              {last && (
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last.body}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function logo(channel: string) {
  if (channel === "ALL") {
    return (
      <span style={{ display: "inline-flex", gap: 1 }}>
        <ChannelBadge withLabel={false} channel="EMAIL" size={13} />
        <ChannelBadge withLabel={false} channel="WHATSAPP" size={13} />
      </span>
    );
  }
  return <ChannelBadge withLabel={false} channel={channel} size={13} />;
}

function FilterChip({
  label,
  href,
  active,
  children,
}: {
  label: string;
  href: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 20,
        fontSize: 13,
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        background: active ? "var(--primary)" : "var(--card)",
        color: active ? "var(--on-primary)" : "var(--foreground)",
        textDecoration: "none",
      }}
    >
      {children}
      {label}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    OPEN: { label: "Sin responder", color: "var(--danger)" },
    READ: { label: "Leída", color: "var(--muted)" },
    RESPONDED: { label: "Respondida", color: "var(--success)" },
    CLOSED: { label: "Cerrada", color: "var(--muted)" },
  };
  const s = map[status] || { label: status, color: "var(--muted)" };
  return (
    <span
      style={{
        fontSize: 12,
        padding: "3px 10px",
        borderRadius: 20,
        background: `${s.color}1a`,
        color: s.color,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  );
}