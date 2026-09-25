import Link from "next/link";
import type { Insight, Tone } from "@/services/analytics";

/**
 * "Lectura de los datos": convierte los KPI en frases accionables priorizadas
 * por severidad. Es la parte que responde "cómo se leen los datos".
 */

const TONE: Record<Tone, { color: string; icon: string; label: string }> = {
  danger: { color: "var(--danger)", icon: "!", label: "Crítico" },
  warning: { color: "var(--warning)", icon: "!", label: "Atención" },
  success: { color: "var(--success)", icon: "✓", label: "Bien" },
  info: { color: "var(--on-surface)", icon: "i", label: "Info" },
};

export default function InsightsPanel({ insights, windowDays }: { insights: Insight[]; windowDays: number }) {
  if (insights.length === 0) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          color: "var(--muted)",
          fontSize: 14,
        }}
      >
        No hay insights todavía: se necesitan mensajes y conversaciones en los últimos {windowDays} días.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      {insights.map((insight) => {
        const tone = TONE[insight.tone];
        return (
          <article
            key={insight.id}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${tone.color}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  background: `${tone.color}1f`,
                  color: tone.color,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {tone.icon}
              </span>
              <h3 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{insight.title}</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{insight.detail}</p>
            {insight.href && insight.action && (
              <Link href={insight.href} style={{ color: "var(--on-surface)", fontSize: 12, fontWeight: 600 }}>
                {insight.action} →
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
