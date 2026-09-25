export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertType = "SLA" | "ESCALATION";

export const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crítica", color: "#dc2626" },
  WARNING: { label: "Advertencia", color: "#d97706" },
  INFO: { label: "Informativa", color: "#16a34a" },
};

export const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SLA: { label: "SLA", color: "#2563eb" },
  ESCALATION: { label: "Escalación", color: "#7c3aed" },
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "#d97706" },
  SENT: { label: "Enviada", color: "#2563eb" },
  ACKED: { label: "Reconocida", color: "#16a34a" },
};

export function severityFor(escalated: boolean, minutes: number, threshold: number): AlertSeverity {
  if (escalated || minutes >= threshold * 2) return "CRITICAL";
  return "WARNING";
}

export function typeFor(escalated: boolean): AlertType {
  return escalated ? "ESCALATION" : "SLA";
}

export function severityRank(severity: string): number {
  if (severity === "CRITICAL") return 3;
  if (severity === "WARNING") return 2;
  return 1;
}