import type { ReactNode } from "react";
import type { ChannelSlice, DayPoint, ResponseBucket, WeekdayBar } from "@/services/analytics";

/**
 * Gráficos del dashboard en SVG puro (sin librerías ni JS de cliente).
 * Todos se pintan con las variables CSS del tema, así que respetan paleta,
 * modo claro/oscuro y colores corporativos de /design.
 */

const MUTED = "var(--muted)";
const GRID = "var(--border)";

function niceStep(rawStep: number): number {
  if (rawStep < 1) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const n = rawStep / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function ChartCard({
  title,
  subtitle,
  badge,
  children,
  minHeight,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        minHeight,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>{title}</h3>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--on-surface)", background: "var(--primary-soft)", padding: "2px 8px", borderRadius: 6 }}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p style={{ fontSize: 12, color: MUTED }}>{subtitle}</p>}
      <div style={{ marginTop: 10, flex: 1 }}>{children}</div>
    </section>
  );
}

function EmptyChart({ height, message }: { height: number; message: string }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: MUTED,
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
      {items.map((item) => (
        <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
          <span
            style={{
              width: 14,
              height: item.dashed ? 0 : 8,
              borderRadius: 3,
              background: item.dashed ? "transparent" : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
              display: "inline-block",
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tendencia: área + línea por día (recibidos vs respondidos)
 * ------------------------------------------------------------------ */
export function TrendChart({ days }: { days: DayPoint[] }) {
  // ViewBox compacto (460x220) + maxWidth: en escritorio nunca escala por encima de 1:1
  // y en móvil (≈340 px de ancho) el texto baja solo a ~0.74, sigue siendo legible.
  const W = 460;
  const H = 220;
  const PL = 34;
  const PR = 8;
  const PT = 12;
  const PB = 28;
  const iw = W - PL - PR;
  const ih = H - PT - PB;

  const maxValue = days.reduce((m, d) => Math.max(m, d.inbound, d.outbound), 0);
  if (maxValue === 0) {
    return <EmptyChart height={H} message="Sin mensajes en el período analizado." />;
  }

  const step = niceStep(maxValue / 4);
  const top = step * 4;
  const x = (i: number) => (days.length <= 1 ? PL + iw / 2 : PL + (i * iw) / (days.length - 1));
  const y = (v: number) => PT + ih - (v / top) * ih;

  const inboundPath = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.inbound).toFixed(1)}`).join(" ");
  const outboundPath = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.outbound).toFixed(1)}`).join(" ");
  const areaPath = `${inboundPath} L${x(days.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${x(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;

  const ticks = [0, 1, 2, 3, 4].map((i) => ({ value: i * step, yPos: y(i * step) }));
  const labelEvery = Math.max(1, Math.ceil(days.length / 5));
  const xLabels = days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % labelEvery === 0 || i === days.length - 1);

  const uid = "trend";
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: W, height: "auto", display: "block", margin: "0 auto" }}
        role="img"
        aria-label="Tendencia diaria de mensajes recibidos y respondidos"
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t.value}>
            <line x1={PL} x2={W - PR} y1={t.yPos} y2={t.yPos} stroke={GRID} strokeWidth="1" />
            <text x={PL - 7} y={t.yPos + 4} textAnchor="end" fontSize="12" fill={MUTED}>
              {t.value}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${uid}-fill)`} />
        <path d={inboundPath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={outboundPath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />

        {days.map((d, i) => (
          <circle key={d.key} cx={x(i)} cy={y(d.inbound)} r={2.5} fill="var(--primary)">
            <title>{`${d.fullLabel}: ${d.inbound} ${d.inbound === 1 ? "recibido" : "recibidos"}, ${d.outbound} ${d.outbound === 1 ? "respondido" : "respondidos"}`}</title>
          </circle>
        ))}

        {xLabels.map(({ d, i }) => (
          <text key={d.key} x={x(i)} y={H - 9} textAnchor="middle" fontSize="12" fill={MUTED}>
            {d.label}
          </text>
        ))}
      </svg>
      <Legend
        items={[
          { label: "Recibidos", color: "var(--primary)" },
          { label: "Respondidos", color: "var(--accent)", dashed: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Torta: reparto del volumen entrante por canal
 * ------------------------------------------------------------------ */
export function DonutChart({ slices, total, centerLabel }: { slices: ChannelSlice[]; total: number; centerLabel: string }) {
  const size = 176;
  const r = 56;
  const stroke = 22;
  const c = 2 * Math.PI * r;

  if (total === 0 || slices.length === 0) {
    return <EmptyChart height={176} message="Sin mensajes entrantes en el período." />;
  }

  let acc = 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 176, height: 176 }} role="img" aria-label="Reparto de mensajes por canal">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--incoming-bg)" strokeWidth={stroke} />
            {slices.map((s) => {
              const len = (s.count / total) * c;
              const el = (
                <circle
                  key={s.channel}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-acc}
                >
                  <title>{`${s.label}: ${s.count} mensajes (${s.share}%)`}</title>
                </circle>
              );
              acc += len;
              return el;
            })}
          </g>
          <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--foreground)">
            {total}
          </text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="11" fill={MUTED}>
            {centerLabel}
          </text>
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {slices.map((s) => (
          <div key={s.channel} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--foreground)" }}>{s.label}</span>
            <span style={{ color: MUTED }}>{s.count}</span>
            <span style={{ fontWeight: 700, minWidth: 40, textAlign: "right" }}>{s.share}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Barras: volumen por día de la semana
 * ------------------------------------------------------------------ */
export function WeekdayBarChart({ bars }: { bars: WeekdayBar[] }) {
  const W = 340;
  const H = 180;
  const PL = 26;
  const PR = 6;
  const PT = 18;
  const PB = 26;
  const iw = W - PL - PR;
  const ih = H - PT - PB;

  const max = bars.reduce((m, b) => Math.max(m, b.count), 0);
  if (max === 0) {
    return <EmptyChart height={H} message="Sin mensajes entrantes en el período." />;
  }

  const slot = iw / bars.length;
  const barW = Math.min(30, slot * 0.6);
  const topValue = niceStep(max);
  const y = (v: number) => PT + ih - (v / topValue) * ih;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, height: "auto", display: "block", margin: "0 auto" }}
      role="img"
      aria-label="Mensajes entrantes por día de la semana"
    >
      <line x1={PL} x2={W - PR} y1={PT + ih} y2={PT + ih} stroke={GRID} strokeWidth="1" />
      {bars.map((bar, i) => {
        const cx = PL + slot * i + slot / 2;
        const h = Math.max(bar.count > 0 ? 3 : 0, (bar.count / topValue) * ih);
        return (
          <g key={bar.index}>
            {bar.count > 0 && (
              <text x={cx} y={y(bar.count) - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--foreground)">
                {bar.count}
              </text>
            )}
            <rect
              x={cx - barW / 2}
              y={PT + ih - h}
              width={barW}
              height={h}
              rx={5}
              style={{ fill: bar.count > 0 ? "var(--primary)" : "transparent" }}
            >
              <title>{`${bar.long}: ${bar.count} ${bar.count === 1 ? "mensaje entrante" : "mensajes entrantes"}`}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill={MUTED}>
              {bar.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Barras horizontales: distribución del tiempo de primera respuesta
 * ------------------------------------------------------------------ */
export function ResponseTimeBars({ buckets, thresholdLabel, samples }: { buckets: ResponseBucket[]; thresholdLabel: string; samples: number }) {
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {buckets.map((b, i) => {
          const last = i === buckets.length - 1;
          const color = b.count === 0 ? "var(--muted)" : last ? "var(--danger)" : i === 0 ? "var(--success)" : "var(--primary)";
          return (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "var(--foreground)" }}>{b.label}</span>
                <span style={{ color: MUTED }}>{b.count}</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "var(--incoming-bg)", overflow: "hidden" }}>
                <div
                  style={{
                    width: max === 0 ? "0%" : `${Math.round(Math.max(b.count > 0 ? 3 : 0, (b.count / max) * 100))}%`,
                    height: "100%",
                    borderRadius: 6,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
        {samples === 0
          ? "Todavía no hay primeras respuestas medidas."
          : `Basado en ${samples} ${samples === 1 ? "conversación respondida" : "conversaciones respondidas"} · SLA configurado: ${thresholdLabel}.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Barras horizontales: top clientes por volumen
 * ------------------------------------------------------------------ */
export function TopContactsBars({ rows }: { rows: { label: string; count: number; share: number }[] }) {
  if (rows.length === 0) {
    return <EmptyChart height={120} message="Sin conversaciones en el período." />;
  }
  const max = rows[0].count;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
            <span style={{ color: MUTED, flexShrink: 0 }}>
              {row.count} · {row.share}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: "var(--incoming-bg)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(Math.max(4, (row.count / max) * 100))}%`, height: "100%", borderRadius: 6, background: "var(--primary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
