/**
 * Analítica del dashboard: lógica pura (sin Prisma ni React).
 *
 * Todo se deriva de mensajes y conversaciones dentro de una ventana móvil de
 * `windowDays` días. Además de las series para los gráficos, produce "insights":
 * lecturas en lenguaje natural de cómo se ven los datos, priorizadas por
 * severidad para que el dashboard diga qué mirar primero.
 */

const MS_DAY = 24 * 60 * 60 * 1000;

const WEEKDAYS = [
  { short: "Dom", long: "domingo" },
  { short: "Lun", long: "lunes" },
  { short: "Mar", long: "martes" },
  { short: "Mié", long: "miércoles" },
  { short: "Jue", long: "jueves" },
  { short: "Vie", long: "viernes" },
  { short: "Sáb", long: "sábado" },
];

const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "#ea4335",
  WHATSAPP: "#25d366",
  TELEGRAM: "#229ed9",
};

const FALLBACK_CHANNEL_COLORS = ["var(--primary)", "var(--accent)", "var(--warning)", "var(--muted)"];

export type Tone = "danger" | "warning" | "success" | "info";

export type Insight = {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  href?: string;
  action?: string;
};

export type DayPoint = {
  key: string;
  label: string;
  fullLabel: string;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  inbound: number;
  outbound: number;
};

export type ChannelSlice = {
  channel: string;
  label: string;
  count: number;
  share: number;
  color: string;
};

export type WeekdayBar = { index: number; short: string; long: string; count: number };

export type ResponseBucket = { label: string; count: number; fromSeconds: number; toSeconds: number };

export type TopContact = { label: string; count: number; share: number };

export type Kpis = {
  windowDays: number;
  inboundTotal: number;
  outboundTotal: number;
  inbound7: number;
  inboundPrev7: number;
  trendPct: number | null;
  openNow: number;
  openOverSla: number;
  oldestOpenMinutes: number | null;
  respondedSamples: number;
  withinSla: number;
  compliancePct: number | null;
  avgResponseSeconds: number | null;
  medianResponseSeconds: number | null;
  channelLeader: ChannelSlice | null;
  peakWeekday: WeekdayBar | null;
  peakWeekdayShare: number;
  topContacts: TopContact[];
  topShare: number;
  channelMix: ChannelSlice[];
  alertsCriticalOpen: number;
  waitingOver24h: number;
  daysSinceLastInbound: number | null;
};

export type DashboardAnalytics = {
  kpis: Kpis;
  days: DayPoint[];
  channels: ChannelSlice[];
  weekdays: WeekdayBar[];
  responseBuckets: ResponseBucket[];
  insights: Insight[];
};

export type AnalyticsMessage = {
  conversationId: string;
  channel: string;
  direction: string;
  isAgentReply: boolean;
  receivedAt: Date;
};

export type AnalyticsConversation = {
  id: string;
  status: string;
  contactId: string;
  contactLabel: string | null;
  createdAt: Date;
  lastIncomingAt: Date | null;
};

export type AnalyticsInput = {
  now: Date;
  windowDays: number;
  slaThresholdMinutes: number;
  messages: AnalyticsMessage[];
  conversations: AnalyticsConversation[];
  alertsCriticalOpen?: number;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayLabel(key: string): { label: string; fullLabel: string } {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    label: `${d} ${MONTHS[m - 1]}`,
    fullLabel: `${WEEKDAYS[date.getDay()].long} ${d} de ${MONTHS[m - 1]}`,
  };
}

export function channelLabel(channel: string): string {
  const c = (channel || "").toUpperCase();
  if (c === "WHATSAPP") return "WhatsApp";
  if (c === "TELEGRAM") return "Telegram";
  if (c === "EMAIL") return "Email";
  return c ? c.charAt(0) + c.slice(1).toLowerCase() : "Otro";
}

function channelColor(channel: string, index: number): string {
  return CHANNEL_COLORS[(channel || "").toUpperCase()] || FALLBACK_CHANNEL_COLORS[index % FALLBACK_CHANNEL_COLORS.length];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return days === 1 ? "1 día" : `${days} días`;
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

const TONE_RANK: Record<Tone, number> = { danger: 4, warning: 3, success: 2, info: 1 };

export function buildAnalytics(input: AnalyticsInput): DashboardAnalytics {
  const { now, windowDays, slaThresholdMinutes, messages, conversations } = input;
  const today = startOfDay(now);
  const windowStart = new Date(today.getTime() - (windowDays - 1) * MS_DAY);
  const thresholdSeconds = Math.max(1, slaThresholdMinutes) * 60;

  // ---------- Serie diaria + volumen de la ventana ----------
  const byDay = new Map<string, { inbound: number; outbound: number; weekday: number }>();
  for (let i = 0; i < windowDays; i += 1) {
    const date = new Date(windowStart.getTime() + i * MS_DAY);
    byDay.set(dayKey(date), { inbound: 0, outbound: 0, weekday: date.getDay() });
  }

  const windowMessages = messages.filter((m) => m.receivedAt.getTime() >= windowStart.getTime());
  for (const m of windowMessages) {
    const bucket = byDay.get(dayKey(m.receivedAt));
    if (!bucket) continue;
    if (m.direction === "INBOUND") bucket.inbound += 1;
    else bucket.outbound += 1;
  }

  const days: DayPoint[] = Array.from(byDay.entries()).map(([key, v]) => {
    const { label, fullLabel } = dayLabel(key);
    return { key, label, fullLabel, weekday: v.weekday, inbound: v.inbound, outbound: v.outbound };
  });

  const inboundTotal = days.reduce((a, d) => a + d.inbound, 0);
  const outboundTotal = days.reduce((a, d) => a + d.outbound, 0);

  // ---------- Tendencia 7 días vs 7 anteriores ----------
  // "Últimos 7 días" = hoy + los 6 días previos; la semana anterior son los 7 previos a esa.
  const recentCut = today.getTime() - 6 * MS_DAY;
  const prevCut = recentCut - 7 * MS_DAY;
  let inbound7 = 0;
  let inboundPrev7 = 0;
  for (const m of windowMessages) {
    if (m.direction !== "INBOUND") continue;
    const t = m.receivedAt.getTime();
    if (t >= recentCut) inbound7 += 1;
    else if (t >= prevCut) inboundPrev7 += 1;
  }
  const trendPct = inboundPrev7 === 0 ? null : Math.round(((inbound7 - inboundPrev7) / inboundPrev7) * 100);

  // ---------- Reparto por canal (solo entrantes) ----------
  const channelCounts = new Map<string, number>();
  for (const m of windowMessages) {
    if (m.direction !== "INBOUND") continue;
    const key = (m.channel || "OTRO").toUpperCase();
    channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
  }
  const channels: ChannelSlice[] = Array.from(channelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count], i) => ({
      channel,
      label: channelLabel(channel),
      count,
      share: pct(count, inboundTotal),
      color: channelColor(channel, i),
    }));

  // ---------- Volumen por día de la semana (ventana actual) ----------
  const weekdayCounts = new Array(7).fill(0);
  for (const d of days) {
    weekdayCounts[d.weekday] += d.inbound;
  }
  const weekdaysOrder = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo
  const weekdays: WeekdayBar[] = weekdaysOrder.map((dayIndex) => ({
    index: dayIndex,
    short: WEEKDAYS[dayIndex].short,
    long: WEEKDAYS[dayIndex].long,
    count: weekdayCounts[dayIndex],
  }));
  const peakWeekday = weekdays.reduce<WeekdayBar | null>(
    (best, w) => (w.count > (best?.count ?? -1) ? w : best),
    null
  );
  const peakWeekdayShare = peakWeekday ? pct(peakWeekday.count, inboundTotal) : 0;

  // ---------- Tiempos de primera respuesta (por conversación) ----------
  const firstInbound = new Map<string, number>();
  for (const m of windowMessages) {
    if (m.direction !== "INBOUND") continue;
    const t = m.receivedAt.getTime();
    const prev = firstInbound.get(m.conversationId);
    if (prev == null || t < prev) firstInbound.set(m.conversationId, t);
  }
  const firstReply = new Map<string, number>();
  for (const m of windowMessages) {
    if (m.direction !== "OUTBOUND" || !m.isAgentReply) continue;
    const t = m.receivedAt.getTime();
    const prev = firstReply.get(m.conversationId);
    if (prev == null || t < prev) firstReply.set(m.conversationId, t);
  }
  const responseSeconds: number[] = [];
  let withinSla = 0;
  firstInbound.forEach((inboundAt, convId) => {
    const replyAt = firstReply.get(convId);
    if (replyAt == null || replyAt < inboundAt) return;
    const seconds = Math.round((replyAt - inboundAt) / 1000);
    responseSeconds.push(seconds);
    if (seconds <= thresholdSeconds) withinSla += 1;
  });
  const respondedSamples = responseSeconds.length;
  const compliancePct = respondedSamples === 0 ? null : pct(withinSla, respondedSamples);
  const avgResponseSeconds =
    responseSeconds.length === 0
      ? null
      : Math.round(responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length);
  const medianResponseSeconds = median(responseSeconds);

  // ---------- Histograma de tiempo de respuesta ----------
  const responseBuckets: ResponseBucket[] = [
    { label: "Menos de 15 min", fromSeconds: 0, toSeconds: 15 * 60, count: 0 },
    { label: "15 min a 1 h", fromSeconds: 15 * 60, toSeconds: 60 * 60, count: 0 },
    { label: "1 a 4 h", fromSeconds: 60 * 60, toSeconds: 4 * 60 * 60, count: 0 },
    { label: "4 a 24 h", fromSeconds: 4 * 60 * 60, toSeconds: 24 * 60 * 60, count: 0 },
    { label: "Más de 24 h", fromSeconds: 24 * 60 * 60, toSeconds: Number.POSITIVE_INFINITY, count: 0 },
  ];
  for (const seconds of responseSeconds) {
    const bucket = responseBuckets.find((b) => seconds >= b.fromSeconds && seconds < b.toSeconds);
    if (bucket) bucket.count += 1;
  }

  // ---------- Estado actual de las conversaciones ----------
  const windowConvs = conversations.filter((c) => c.createdAt.getTime() >= windowStart.getTime());
  const openConvs = windowConvs.filter((c) => c.status === "OPEN");
  const openOverSla = openConvs.filter(
    (c) => c.lastIncomingAt != null && now.getTime() - c.lastIncomingAt.getTime() > thresholdSeconds * 1000
  );
  const oldestOpenMinutes = openConvs.reduce<number | null>((oldest, c) => {
    if (!c.lastIncomingAt) return oldest;
    const minutes = Math.floor((now.getTime() - c.lastIncomingAt.getTime()) / 60000);
    return oldest == null || minutes > oldest ? minutes : oldest;
  }, null);
  const waitingOver24h = openConvs.filter(
    (c) => c.lastIncomingAt != null && now.getTime() - c.lastIncomingAt.getTime() > 24 * 60 * 60 * 1000
  );

  // ---------- Concentración por cliente ----------
  const perContact = new Map<string, { label: string; count: number }>();
  for (const c of windowConvs) {
    const label = c.contactLabel || "Sin nombre";
    const prev = perContact.get(c.contactId);
    if (prev) prev.count += 1;
    else perContact.set(c.contactId, { label, count: 1 });
  }
  const topContacts: TopContact[] = Array.from(perContact.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ label: c.label, count: c.count, share: pct(c.count, windowConvs.length) }));
  const topShare = pct(topContacts.slice(0, 3).reduce((a, c) => a + c.count, 0), windowConvs.length);

  const kpis: Kpis = {
    windowDays,
    inboundTotal,
    outboundTotal,
    inbound7,
    inboundPrev7,
    trendPct,
    openNow: openConvs.length,
    openOverSla: openOverSla.length,
    oldestOpenMinutes,
    respondedSamples,
    withinSla,
    compliancePct,
    avgResponseSeconds,
    medianResponseSeconds,
    channelLeader: channels[0] || null,
    peakWeekday,
    peakWeekdayShare,
    topContacts,
    topShare,
    channelMix: channels.slice(0, 3),
    alertsCriticalOpen: input.alertsCriticalOpen ?? 0,
    waitingOver24h: waitingOver24h.length,
    daysSinceLastInbound: daysSinceLastInbound(windowMessages, now),
  };

  return { kpis, days, channels, weekdays, responseBuckets, insights: buildInsights(kpis, slaThresholdMinutes) };
}

/**
 * Insights: la lectura de los datos. Cada regla produce una frase accionable y
 * se ordena por severidad (crítico → informativo).
 */
export function buildInsights(kpis: Kpis, slaThresholdMinutes: number): Insight[] {
  const insights: Insight[] = [];
  const thresholdLabel = formatMinutes(slaThresholdMinutes);

  // 0. Sin nada que analizar
  if (kpis.inboundTotal === 0) {
    insights.push({
      id: "sin-mensajes",
      tone: "info",
      title: `Sin mensajes entrantes en los últimos ${kpis.windowDays} días`,
      detail:
        kpis.daysSinceLastInbound != null
          ? `El último mensaje llegó hace ${dayWord(kpis.daysSinceLastInbound)}. Conviene revisar la sincronización de correo o que el número de WhatsApp siga conectado.`
          : "Todavía no hay mensajes en el CRM: conectá una fuente de correo o WhatsApp, o cargá datos de ejemplo con npm run demo.",
    });
  }

  // 1. Backlog por encima del SLA
  if (kpis.openOverSla > 0) {
    insights.push({
      id: "sla-backlog",
      tone: "danger",
      title: `${kpis.openOverSla} ${plural(kpis.openOverSla, "conversación abierta", "conversaciones abiertas")} fuera del SLA`,
      detail:
        kpis.oldestOpenMinutes != null
          ? `La más antigua lleva ${formatMinutes(kpis.oldestOpenMinutes)} sin respuesta, con un umbral de ${thresholdLabel}.`
          : `El umbral configurado es de ${thresholdLabel}.`,
      href: "/conversations",
      action: "Ver conversations",
    });
  }

  // 2. Almacenamiento: más de 24 h esperando
  if (kpis.waitingOver24h > 0) {
    insights.push({
      id: "mas-24h",
      tone: "danger",
      title: `${kpis.waitingOver24h} ${plural(kpis.waitingOver24h, "conversación lleva", "conversaciones llevan")} más de 24 h esperando respuesta`,
      detail: "Un contacto que espera un día suele convertirse en contacto perdido.",
      href: "/conversations",
      action: "Abrir bandeja",
    });
  }

  // 3. Alertas críticas sin confirmar
  if (kpis.alertsCriticalOpen > 0) {
    insights.push({
      id: "alertas-criticas",
      tone: "danger",
      title: `${kpis.alertsCriticalOpen} ${plural(kpis.alertsCriticalOpen, "alerta crítica", "alertas críticas")} sin resolver`,
      detail: "Las alertas sin confirmar son SLA vencido que el equipo todavía no ha visto.",
      href: "/alerts",
      action: "Revisar alertas",
    });
  }

  // 4. Cumplimiento del SLA (omitido si la ventana está vacía: ya lo dice el insight 0)
  if (kpis.respondedSamples === 0 && kpis.inboundTotal > 0) {
    insights.push({
      id: "sla-sin-datos",
      tone: "info",
      title: "Sin tiempos de respuesta medidos todavía",
      detail: `En cuanto respondas con la app, cada primera respuesta se cronometra contra el SLA de ${thresholdLabel}.`,
    });
  } else if (kpis.compliancePct === 0) {
    insights.push({
      id: "sla-cumplimiento-cero",
      tone: "danger",
      title: "Ninguna respuesta llegó dentro del SLA",
      detail: `${kpis.respondedSamples} ${plural(kpis.respondedSamples, "conversación se respondió", "conversaciones se respondieron")} después de los ${thresholdLabel}. Es el punto más urgente a arreglar.`,
      href: "/conversations",
      action: "Ver pendientes",
    });
  } else if (kpis.compliancePct != null && kpis.compliancePct < 80) {
    insights.push({
      id: "sla-cumplimiento-bajo",
      tone: kpis.compliancePct < 50 ? "danger" : "warning",
      title: `Solo el ${kpis.compliancePct}% de las respuestas cumple el SLA`,
      detail: `${kpis.withinSla} de ${kpis.respondedSamples} conversaciones se respondieron dentro de los ${thresholdLabel}. La mediana de respuesta es de ${formatDurationShort(kpis.medianResponseSeconds ?? 0)}.`,
      href: "/conversations",
      action: "Ver pendientes",
    });
  } else if (kpis.compliancePct != null) {
    insights.push({
      id: "sla-cumplimiento-ok",
      tone: "success",
      title: `El ${kpis.compliancePct}% de las respuestas llega dentro del SLA`,
      detail: `${kpis.withinSla} de ${kpis.respondedSamples} conversaciones respondidas en ${thresholdLabel} o menos. Mediana: ${formatDurationShort(kpis.medianResponseSeconds ?? 0)}.`,
    });
  }

  // 5. Tendencia semanal
  if (kpis.trendPct != null && Math.abs(kpis.trendPct) >= 10) {
    const up = kpis.trendPct > 0;
    insights.push({
      id: "tendencia",
      tone: up ? (kpis.openOverSla > 0 ? "warning" : "info") : "success",
      title: up
        ? `El volumen subió ${kpis.trendPct}% esta semana`
        : `El volumen bajó ${Math.abs(kpis.trendPct)}% esta semana`,
      detail: `${kpis.inbound7} mensajes entrantes en los últimos 7 días, frente a ${kpis.inboundPrev7} en los 7 anteriores.`,
    });
  } else if (kpis.inbound7 === 0 && kpis.inboundPrev7 === 0 && kpis.inboundTotal > 0) {
    insights.push({
      id: "tendencia-sin-actividad",
      tone: "info",
      title: "Sin mensajes entrantes en la última semana",
      detail: `En los ${kpis.windowDays} días analizados entraron ${kpis.inboundTotal} mensajes, ninguno en la última semana. Revisa que el sincronismo de correo siga activo.`,
    });
  }

  // 6. Canal dominante
  if (kpis.channelLeader && kpis.inboundTotal >= 5) {
    const leader = kpis.channelLeader;
    const others = kpis.channelMix
      .slice(1, 3)
      .map((c) => `${c.label} ${c.share}%`)
      .join(" · ");
    insights.push({
      id: "canal",
      tone: "info",
      title: `${leader.label} concentra el ${leader.share}% del volumen entrante`,
      detail: `${leader.count} de ${kpis.inboundTotal} mensajes${others ? ` (${others})` : ""}. Conviene mirar el SLA de ${leader.label} por separado.`,
    });
  }

  // 7. Día de mayor carga
  if (kpis.peakWeekday && kpis.inboundTotal >= 10 && kpis.peakWeekdayShare >= 20) {
    insights.push({
      id: "dia-pico",
      tone: "info",
      title: `El ${kpis.peakWeekday.long} es el día de más carga`,
      detail: `${kpis.peakWeekdayShare}% del volumen de los últimos ${kpis.windowDays} días cae ese día (${kpis.peakWeekday.count} mensajes). Programar refuerzo ese día suele ser el cambio más barato.`,
    });
  }

  // 8. Concentración de clientes
  if (kpis.topContacts.length >= 3 && kpis.topShare >= 50) {
    insights.push({
      id: "concentracion",
      tone: "warning",
      title: `El ${kpis.topShare}% de las conversaciones viene de 3 clientes`,
      detail: `${Array.from(new Set(kpis.topContacts.slice(0, 3).map((c) => c.label))).join(", ")}. Si uno se va, el volumen cae casi entero: conviene diversificar la cartera.`,
      href: "/conversations",
      action: "Ver clientes",
    });
  }

  // 9. Estado de la cartera
  if (kpis.openNow === 0 && kpis.inboundTotal > 0) {
    insights.push({
      id: "todo-cerrado",
      tone: "success",
      title: "Bandeja al día: no hay conversaciones abiertas",
      detail: `Las ${kpis.inboundTotal} conversaciones del período están respondidas.`,
    });
  }

  return insights.sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);
}

function dayWord(days: number): string {
  if (days <= 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.round(days / 7);
  return weeks <= 1 ? "hace una semana" : `hace ${weeks} semanas`;
}

function daysSinceLastInbound(messages: AnalyticsMessage[], now: Date): number | null {
  let latest: number | null = null;
  for (const m of messages) {
    if (m.direction !== "INBOUND") continue;
    const t = m.receivedAt.getTime();
    if (latest == null || t > latest) latest = t;
  }
  return latest == null ? null : Math.max(0, Math.floor((now.getTime() - latest) / MS_DAY));
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
