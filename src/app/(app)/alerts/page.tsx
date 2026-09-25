import Link from "next/link";
import { initPragmas, prisma } from "@/lib/prisma";
import ChannelBadge from "@/components/channel-badge";
import { SEVERITY_LABELS, TYPE_LABELS, STATUS_LABELS, severityRank } from "@/services/alerts/meta";

type AlertsSearchParams = {
  severity?: string;
  type?: string;
  channel?: string;
  status?: string;
};

const M = 60 * 1000;

export default async function AlertsPage({ searchParams }: { searchParams: AlertsSearchParams }) {
  await initPragmas();

  const severity = searchParams.severity;
  const type = searchParams.type;
  const channel = searchParams.channel;
  const status = searchParams.status;

  const alerts = await prisma.alert.findMany({
    where: {
      ...(severity ? { severity } : {}),
      ...(type ? { type } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    },
    include: { conversation: { include: { contact: true } } },
    orderBy: [{ triggeredAt: "desc" }],
  });

  const now = new Date();

  const severityGroups: { key: string; label: string }[] = [
    { key: "", label: "Todas" },
    { key: "CRITICAL", label: "Crítica" },
    { key: "WARNING", label: "Advertencia" },
    { key: "INFO", label: "Informativa" },
  ];
  const typeGroups = [
    { key: "", label: "Todos" },
    { key: "SLA", label: "SLA" },
    { key: "ESCALATION", label: "Escalación" },
  ];
  const channelGroups = [
    { key: "", label: "Todos" },
    { key: "DASHBOARD", label: "Dashboard" },
    { key: "EMAIL", label: "Email" },
    { key: "TELEGRAM", label: "Telegram" },
  ];
  const statusGroups = [
    { key: "", label: "Todos" },
    { key: "PENDING", label: "Pendiente" },
    { key: "SENT", label: "Enviada" },
    { key: "ACKED", label: "Reconocida" },
  ];

  const params = { severity, type, channel, status };

  const activeCount =
    alerts.filter((a) => a.status === "PENDING" || a.status === "SENT").length;
  const critCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status !== "ACKED").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22 }}>Alertas</h1>
        {activeCount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#d97706", background: "#d977061a", padding: "4px 10px", borderRadius: 20 }}>
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
          </span>
        )}
        {critCount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", background: "#dc26261a", padding: "4px 10px", borderRadius: 20 }}>
            {critCount} crítica{critCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
        Filtra por gravedad, tipo, canal o estado. <Link href="/dashboard" style={{ color: "var(--on-surface)" }}>Ir al dashboard</Link>
      </p>

      <FilterRow label="Gravedad" groups={severityGroups} current={severity} params={params} paramKey="severity" />
      <FilterRow label="Tipo" groups={typeGroups} current={type} params={params} paramKey="type" />
      <FilterRow label="Canal" groups={channelGroups} current={channel} params={params} paramKey="channel" />
      <FilterRow label="Estado" groups={statusGroups} current={status} params={params} paramKey="status" />

      <div style={{ height: 16 }} />

      {alerts.length === 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14, marginTop: 16 }}>
          No hay alertas que coincidan con los filtros.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {alerts
          .slice()
          .sort((a, b) => {
            const rank = severityRank(b.severity) - severityRank(a.severity);
            if (rank !== 0) return rank;
            return b.triggeredAt.getTime() - a.triggeredAt.getTime();
          })
          .map((a) => {
            const conv = a.conversation;
            const contact = conv.contact;
            const sev = SEVERITY_LABELS[a.severity] || SEVERITY_LABELS.WARNING;
            const tpe = TYPE_LABELS[a.type] || TYPE_LABELS.SLA;
            const st = STATUS_LABELS[a.status] || STATUS_LABELS.PENDING;
            const ago = timeAgo(a.triggeredAt, now);
            return (
              <div
                key={a.id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <span
                  style={{
                    width: 4,
                    alignSelf: "stretch",
                    borderRadius: 4,
                    background: sev.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 100 }}>
                  <SevBadge label={sev.label} color={sev.color} />
                </div>
                <div style={{ minWidth: 96 }}>
                  <TypeBadge label={tpe.label} color={tpe.color} />
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <Link
                    href={`/conversations/${conv.id}`}
                    style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", textDecoration: "none" }}
                  >
                    {contact.name || contact.email || contact.phone || "Contacto"}
                  </Link>
                  {conv.subject && (
                    <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 6 }}>· {conv.subject}</span>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    hace {ago} · umbral {a.thresholdMin} min
                    {conv.lastIncomingAt && (
                      <span> · sin respuesta {Math.max(0, Math.floor((now.getTime() - conv.lastIncomingAt.getTime()) / M))} min</span>
                    )}
                  </div>
                </div>
                <div style={{ minWidth: 70, textAlign: "center" }}>
                  {a.channel === "DASHBOARD" ? (
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, background: "#6b72801a", color: "#6b7280", whiteSpace: "nowrap" }}>
                      Panel
                    </span>
                  ) : (
                    <ChannelBadge channel={a.channel} withLabel={false} size={16} />
                  )}
                </div>
                <div style={{ minWidth: 110, textAlign: "right" }}>
                  <StatusBadge label={st.label} color={st.color} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  groups,
  current,
  params,
  paramKey,
}: {
  label: string;
  groups: { key: string; label: string }[];
  current?: string;
  params: AlertsSearchParams;
  paramKey: keyof AlertsSearchParams;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", minWidth: 82 }}>
        {label}
      </span>
      {groups.map((g) => {
        const active = g.key === "" ? !current : current === g.key;
        const qp = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v) qp.set(k, v);
        }
        if (g.key) qp.set(paramKey, g.key);
        else qp.delete(paramKey);
        const href = qp.toString() ? `/alerts?${qp.toString()}` : "/alerts";
        return (
          <a
            key={g.label}
            href={href}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 12,
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
              background: active ? "var(--primary)" : "var(--card)",
              color: active ? "var(--on-primary)" : "var(--foreground)",
              textDecoration: "none",
            }}
          >
            {g.label}
          </a>
        );
      })}
    </div>
  );
}

function SevBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, background: `${color}1a`, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, background: `${color}1a`, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, background: `${color}1a`, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function timeAgo(date: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  if (diff < M) return `${Math.floor(diff / 1000)}s`;
  if (diff < 60 * M) return `${Math.floor(diff / M)}min`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / (3600 * 1000))}h`;
  return `${Math.floor(diff / (24 * 3600 * 1000))}d`;
}