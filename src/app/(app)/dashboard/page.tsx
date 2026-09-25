import Link from "next/link";
import { initPragmas, prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { slaEngine } from "@/services/sla/engine";
import { buildAnalytics } from "@/services/analytics";
import ChannelBadge from "@/components/channel-badge";
import InsightsPanel from "@/components/analytics/insights";
import {
  ChartCard,
  DonutChart,
  ResponseTimeBars,
  TopContactsBars,
  TrendChart,
  WeekdayBarChart,
} from "@/components/analytics/charts";

const M = 60 * 1000;
const DAY = 24 * 60 * M;

/** Ventana de análisis de la sección "Analítica". */
const ANALYTICS_WINDOW_DAYS = 30;

type Importance = { label: string; color: string };

function conversationImportance(
  conv: {
    status: string;
    lastIncomingAt: Date | null;
    alerts: { status: string; escalated: boolean }[];
  },
  thresholdMin: number,
  now: Date
): Importance {
  const hasActive = conv.alerts.some((a) => a.status === "PENDING" || a.status === "SENT");
  const escalated = conv.alerts.some((a) => a.escalated && (a.status === "PENDING" || a.status === "SENT"));

  if (escalated) return { label: "Crítico", color: "var(--danger)" };
  if (hasActive) return { label: "Urgente", color: "var(--warning)" };
  if (conv.status === "OPEN") {
    const mins = slaEngine.minutesSince(conv, now) ?? 0;
    if (mins >= thresholdMin * 2) return { label: "Crítico", color: "var(--danger)" };
    if (mins >= thresholdMin) return { label: "Urgente", color: "var(--warning)" };
    return { label: "Pendiente", color: "var(--on-surface)" };
  }
  return { label: "Respondido", color: "var(--success)" };
}

export default async function DashboardPage() {
  await initPragmas();

  const env = getEnv();
  const thresholdSetting = await prisma.setting.findUnique({ where: { key: "sla.threshold.minutes" } });
  const thresholdMin = thresholdSetting ? Number(thresholdSetting.value) || env.slaThresholdMinutes : env.slaThresholdMinutes;
  const now = new Date();

  const [contacts, conversations, openConvs, pendingAlerts] = await Promise.all([
    prisma.contact.count(),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { status: "OPEN" } }),
    prisma.alert.count({ where: { status: { in: ["PENDING", "SENT"] } } }),
  ]);

  // Metadatos de mensajes de la ventana para los gráficos (sin cuerpo: solo métricas)
  const [analyticsMessages, criticalAlerts] = await Promise.all([
    prisma.message.findMany({
      where: { receivedAt: { gte: new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * DAY) } },
      select: { conversationId: true, channel: true, direction: true, isAgentReply: true, receivedAt: true },
    }),
    prisma.alert.count({ where: { severity: "CRITICAL", status: { in: ["PENDING", "SENT"] } } }),
  ]);


  // Todas las conversaciones con contacto, última alerta activa y último mensaje
  const convs = await prisma.conversation.findMany({
    include: {
      contact: true,
      messages: { orderBy: { receivedAt: "desc" }, take: 1 },
      alerts: { where: { status: { in: ["PENDING", "SENT"] } }, orderBy: { triggeredAt: "desc" } },
    },
    orderBy: { lastIncomingAt: "desc" },
  });

  const analytics = buildAnalytics({
    now,
    windowDays: ANALYTICS_WINDOW_DAYS,
    slaThresholdMinutes: thresholdMin,
    alertsCriticalOpen: criticalAlerts,
    messages: analyticsMessages,
    conversations: convs.map((c) => ({
      id: c.id,
      status: c.status,
      contactId: c.contactId,
      contactLabel: c.contact.name,
      createdAt: c.createdAt,
      lastIncomingAt: c.lastIncomingAt,
    })),
  });

  // Primeras respuestas (para el tiempo de respuesta promedio)
  const firstResponses = await prisma.message.findMany({
    where: { isFirstResponse: true, slaSeconds: { not: null } },
    select: { conversationId: true, slaSeconds: true },
  });

  // ---- Resumen por cliente ----
  const byContact = new Map<string, {
    contact: typeof convs[number]["contact"];
    conversations: number;
    slaSeconds: number[];
    lastMessage: typeof convs[number]["messages"][number] | null;
    lastIncomingAt: Date | null;
    worst: Importance;
  }>();

  const slaByConv = new Map<string, number>();
  for (const fr of firstResponses) {
    if (fr.slaSeconds != null) slaByConv.set(fr.conversationId, fr.slaSeconds);
  }

  for (const conv of convs) {
    const key = conv.contactId;
    let row = byContact.get(key);
    if (!row) {
      row = {
        contact: conv.contact,
        conversations: 0,
        slaSeconds: [],
        lastMessage: null,
        lastIncomingAt: null,
        worst: { label: "Respondido", color: "var(--success)" },
      };
      byContact.set(key, row);
    }
    row.conversations += 1;
    const sla = slaByConv.get(conv.id);
    if (sla != null) row.slaSeconds.push(sla);
    if (
      conv.lastIncomingAt &&
      (!row.lastIncomingAt || conv.lastIncomingAt.getTime() > row.lastIncomingAt.getTime())
    ) {
      row.lastIncomingAt = conv.lastIncomingAt;
      row.lastMessage = conv.messages[0] ?? null;
    }
    const imp = conversationImportance(conv, thresholdMin, now);
    const rank = importanceRank(imp.label);
    if (rank > importanceRank(row.worst.label)) row.worst = imp;
  }

  const clientRows = Array.from(byContact.values())
    .map((r) => {
      const avg = r.slaSeconds.length > 0 ? Math.round(r.slaSeconds.reduce((a, b) => a + b, 0) / r.slaSeconds.length) : null;
      return { ...r, avgSeconds: avg };
    })
    .sort((a, b) => importanceRank(b.worst.label) - importanceRank(a.worst.label) || (b.lastIncomingAt?.getTime() ?? 0) - (a.lastIncomingAt?.getTime() ?? 0));

  const allSlaSeconds = Array.from(slaByConv.values());
  const avgSlaSeconds = allSlaSeconds.length > 0 ? Math.round(allSlaSeconds.reduce((a, b) => a + b, 0) / allSlaSeconds.length) : null;

  // ---- Bandeja: últimos mensajes (vista de ejemplo con alertas) ----
  // El tono de la tendencia solo es malo si además hay backlog: subir volumen con todo
  // al día es buena noticia.
  const trendTone: "danger" | "success" | "warning" | undefined =
    analytics.kpis.trendPct == null || analytics.kpis.trendPct === 0
      ? undefined
      : analytics.kpis.trendPct > 0
      ? analytics.kpis.openOverSla > 0
        ? "warning"
        : undefined
      : "success";

  const bandeja = convs.slice(0, 10).map((conv) => {
    const importancia = conversationImportance(conv, thresholdMin, now);
    const last = conv.messages[0];
    return { conv, last, importancia };
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Umbral SLA: <strong>{thresholdMin} minutos</strong> · <Link href="/settings" style={{ color: "var(--on-surface)" }}>Ajustar</Link>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
        <StatCard label="Contactos" value={contacts} />
        <StatCard label="Conversaciones" value={conversations} />
        <StatCard label="Abiertas" value={openConvs} tone={openConvs > 0 ? "warning" : "success"} />
        <StatCard label="Alertas activas" value={pendingAlerts} tone={pendingAlerts > 0 ? "danger" : "success"} href="/alerts" />
        <StatCard label="Promedio 1ª respuesta" value={slaEngine.formatDuration(avgSlaSeconds)} small />
      </div>

      {/* ---- Analítica: gráficos + lectura de los datos ---- */}
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Analítica</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
        Últimos {ANALYTICS_WINDOW_DAYS} días · {analytics.kpis.inboundTotal} mensajes entrantes ·{" "}
        {analytics.kpis.outboundTotal} respondidos · SLA de {thresholdMin} min
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        <MiniStat
          label="Cumplimiento del SLA"
          value={analytics.kpis.compliancePct != null ? `${analytics.kpis.compliancePct}%` : "—"}
          tone={
            analytics.kpis.compliancePct == null
              ? undefined
              : analytics.kpis.compliancePct >= 80
              ? "success"
              : analytics.kpis.compliancePct >= 50
              ? "warning"
              : "danger"
          }
          hint={analytics.kpis.respondedSamples > 0 ? `${analytics.kpis.withinSla}/${analytics.kpis.respondedSamples} a tiempo` : "sin datos aún"}
        />
        <MiniStat
          label="Mediana de 1ª respuesta"
          value={slaEngine.formatDuration(analytics.kpis.medianResponseSeconds)}
          hint={analytics.kpis.avgResponseSeconds != null ? `media ${slaEngine.formatDuration(analytics.kpis.avgResponseSeconds)}` : undefined}
        />
        <MiniStat
          label="Tendencia (7 días)"
          value={
            analytics.kpis.trendPct == null
              ? "sin base"
              : `${analytics.kpis.trendPct > 0 ? "+" : ""}${analytics.kpis.trendPct}%`
          }
          tone={trendTone}
          hint={`${analytics.kpis.inbound7} vs ${analytics.kpis.inboundPrev7} la semana previa`}
        />
        <MiniStat
          label="Canal principal"
          value={analytics.kpis.channelLeader ? `${analytics.kpis.channelLeader.share}%` : "—"}
          hint={analytics.kpis.channelLeader ? analytics.kpis.channelLeader.label : "sin entradas"}
        />
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        Lectura de los datos
      </h3>
      <InsightsPanel insights={analytics.insights} windowDays={ANALYTICS_WINDOW_DAYS} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 20 }}>
        <ChartCard
          title="Tendencia de mensajes"
          subtitle="Entrantes y respuestas por día"
          badge={
            analytics.kpis.trendPct == null
              ? undefined
              : `${analytics.kpis.trendPct > 0 ? "+" : ""}${analytics.kpis.trendPct}% vs. semana previa`
          }
        >
          <TrendChart days={analytics.days} />
        </ChartCard>
        <ChartCard title="Mensajes por canal" subtitle="Reparto del volumen entrante">
          <DonutChart slices={analytics.channels} total={analytics.kpis.inboundTotal} centerLabel="recibidos" />
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
        <ChartCard
          title="Carga por día de la semana"
          subtitle={
            analytics.kpis.peakWeekday && analytics.kpis.peakWeekday.count > 0
              ? `El ${analytics.kpis.peakWeekday.long} concentra el ${analytics.kpis.peakWeekdayShare}% del volumen`
              : "Mensajes entrantes por día"
          }
        >
          <WeekdayBarChart bars={analytics.weekdays} />
        </ChartCard>
        <ChartCard title="Tiempo de primera respuesta" subtitle="Distribución de las respuestas medidas">
          <ResponseTimeBars
            buckets={analytics.responseBuckets}
            thresholdLabel={slaEngine.formatDuration(thresholdMin * 60)}
            samples={analytics.kpis.respondedSamples}
          />
        </ChartCard>
      </div>

      <div style={{ marginTop: 16, marginBottom: 28 }}>
        <ChartCard
          title="Clientes con más conversaciones"
          subtitle={
            analytics.kpis.topShare >= 50
              ? `El ${analytics.kpis.topShare}% del volumen viene de 3 clientes`
              : `Reparto del volumen · ${analytics.kpis.openNow} abiertas ahora`
          }
        >
          <TopContactsBars rows={analytics.kpis.topContacts} />
        </ChartCard>
      </div>

      {/* ---- Clientes que escribieron ---- */}
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Clientes que escribieron</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
        Tiempo de respuesta promedio por canal y última actividad. Importancia: <BadgeDot color="var(--danger)" /> Crítico · <BadgeDot color="var(--warning)" /> Urgente · <BadgeDot color="var(--primary)" /> Pendiente · <BadgeDot color="var(--success)" /> Respondido
      </p>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.9fr 2.2fr 0.8fr 0.8fr", gap: 8, padding: "12px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Cliente</span>
          <span>Canal</span>
          <span>T. resp. prom.</span>
          <span>Último mensaje</span>
          <span>Tiempo</span>
          <span>Estado</span>
        </div>
        {clientRows.length === 0 && (
          <div style={{ padding: "32px 16px", color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
            Todavía no hay contactos. Ejecuta <code>npm run demo</code> para cargar datos de ejemplo.
          </div>
        )}
        {clientRows.map((row) => {
          const ch = row.lastMessage?.channel || "";
          return (
            <div key={row.contact.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.9fr 2.2fr 0.8fr 0.8fr", gap: 8, padding: "12px 16px", fontSize: 14, borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{row.contact.name || "Sin nombre"}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{row.contact.email || row.contact.phone}</div>
              </div>
              <div>
                <ChannelBadge channel={ch} />
              </div>
              <div style={{ fontWeight: 600 }}>{slaEngine.formatDuration(row.avgSeconds)}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {row.lastMessage ? `"${truncate(row.lastMessage.body, 42)}"` : "—"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                {row.lastIncomingAt ? `hace ${timeAgo(row.lastIncomingAt, now)}` : ""}
              </div>
              <div><Badge label={row.worst.label} color={row.worst.color} /></div>
            </div>
          );
        })}
      </div>

      {/* ---- Bandeja de ejemplo ---- */}
      <h2 style={{ fontSize: 17, marginBottom: 12 }}>Bandeja de mensajes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {bandeja.length === 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "32px 16px", color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
            Sin mensajes todavía.
          </div>
        )}
        {bandeja.map(({ conv, last, importancia }) => {
          if (!last) return null;
          const direction = last.direction === "INBOUND" ? "Recibido" : "Respondido";
          return (
            <Link
              key={last.id}
              href={`/conversations/${conv.id}`}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                textDecoration: "none",
                color: "var(--foreground)",
              }}
            >
              <div style={{ minWidth: 92 }}>
                <ChannelBadge channel={last.channel} />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {conv.contact.name || conv.contact.email || conv.contact.phone || "Contacto"}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {truncate(last.body, 70)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <Badge label={importancia.label} color={importancia.color} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{direction}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>hace {timeAgo(last.receivedAt, now)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function importanceRank(label: string): number {
  const ranks: Record<string, number> = { "Crítico": 4, "Urgente": 3, "Pendiente": 2, "Respondido": 1 };
  return ranks[label] ?? 0;
}

function timeAgo(date: Date, now: Date): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  if (diff < M) return `${Math.floor(diff / 1000)}s`;
  if (diff < 60 * M) return `${Math.floor(diff / M)}min`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / (3600 * 1000))}h`;
  return `${Math.floor(diff / (24 * 3600 * 1000))}d`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 6,
        background: `${color}1a`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function BadgeDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 99,
        background: color,
        marginRight: 2,
        verticalAlign: "middle",
      }}
    />
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger" | "success" | "warning";
}) {
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "success"
      ? "var(--success)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--foreground)";
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, margin: "2px 0" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  small,
  href,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "success" | "warning";
  small?: boolean;
  href?: string;
}) {
  const color =
    tone === "danger" ? "var(--danger)" : tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : "var(--foreground)";
  const inner = (
    <>
      <div style={{ fontSize: small ? 20 : 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 14, color: "var(--muted)" }}>{label}</div>
    </>
  );
  return (
    <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", padding: 20 }}>
      {href ? (
        <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}