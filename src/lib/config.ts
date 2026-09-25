import { getEnv, type Env } from "@/lib/env";
import { initPragmas, prisma } from "@/lib/prisma";

// La configuración guardada desde la web (`Setting` con prefijo `cfg.`)
// tiene PRIORIDAD sobre las variables de entorno del archivo .env.
const PREFIX = "cfg.";

export type EnvKey = keyof Env;
export type ConfigVar = string;

// Mapeo variable de entorno -> clave del objeto Env
const VAR_TO_KEY: Record<ConfigVar, EnvKey> = {
  EMAIL_IMAP_HOST: "imapHost",
  EMAIL_IMAP_PORT: "imapPort",
  EMAIL_IMAP_USER: "imapUser",
  EMAIL_IMAP_PASSWORD: "imapPassword",
  EMAIL_IMAP_SYNC_INTERVAL_MS: "imapSyncIntervalMs",
  EMAIL_IMAP_LOOKBACK_DAYS: "imapLookbackDays",
  EMAIL_SMTP_HOST: "smtpHost",
  EMAIL_SMTP_PORT: "smtpPort",
  EMAIL_SMTP_USER: "smtpUser",
  EMAIL_SMTP_PASSWORD: "smtpPassword",
  EMAIL_FROM_NAME: "fromName",
  SLA_THRESHOLD_MINUTES: "slaThresholdMinutes",
  ALERT_CHECK_INTERVAL_MS: "alertCheckIntervalMs",
  ALERT_EMAIL_TO: "alertEmailTo",
  TELEGRAM_BOT_TOKEN: "telegramBotToken",
  TELEGRAM_CHAT_ID: "telegramChatId",
  WA_PHONE_NUMBER_ID: "waPhoneNumberId",
  WA_BUSINESS_ACCOUNT_ID: "waBusinessAccountId",
  WA_ACCESS_TOKEN: "waAccessToken",
  WA_APP_SECRET: "waAppSecret",
  WA_WEBHOOK_VERIFY_TOKEN: "waWebhookVerifyToken",
  WA_GRAPH_VERSION: "waGraphVersion",
};

const NUMERIC_KEYS = new Set<EnvKey>([
  "imapPort",
  "imapSyncIntervalMs",
  "imapLookbackDays",
  "smtpPort",
  "slaThresholdMinutes",
  "alertCheckIntervalMs",
]);

// Campos que el usuario puede editar desde la web (los demás son de infra)
// y el grupo al que pertenecen (correo / whatsapp / telegram / sla).
export const EDITABLE_FIELDS: {
  varName: ConfigVar;
  key: EnvKey;
  group: "email" | "whatsapp" | "telegram";
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
}[] = [
  { varName: "EMAIL_IMAP_HOST", key: "imapHost", group: "email", label: "Host IMAP", type: "text", placeholder: "imap.gmail.com" },
  { varName: "EMAIL_IMAP_PORT", key: "imapPort", group: "email", label: "Puerto IMAP", type: "number", placeholder: "993" },
  { varName: "EMAIL_IMAP_USER", key: "imapUser", group: "email", label: "Usuario IMAP (correo)", type: "text", placeholder: "tucorreo@gmail.com" },
  { varName: "EMAIL_IMAP_PASSWORD", key: "imapPassword", group: "email", label: "Contraseña de aplicación (IMAP)", type: "password", placeholder: "abcd efgh ijkl mnop" },
  { varName: "EMAIL_IMAP_LOOKBACK_DAYS", key: "imapLookbackDays", group: "email", label: "Días hacia atrás (primera sincronización)", type: "number", placeholder: "30" },
  { varName: "EMAIL_SMTP_HOST", key: "smtpHost", group: "email", label: "Host SMTP", type: "text", placeholder: "smtp.gmail.com" },
  { varName: "EMAIL_SMTP_PORT", key: "smtpPort", group: "email", label: "Puerto SMTP", type: "number", placeholder: "465" },
  { varName: "EMAIL_SMTP_USER", key: "smtpUser", group: "email", label: "Usuario SMTP (correo)", type: "text", placeholder: "tucorreo@gmail.com" },
  { varName: "EMAIL_SMTP_PASSWORD", key: "smtpPassword", group: "email", label: "Contraseña de aplicación (SMTP)", type: "password", placeholder: "abcd efgh ijkl mnop" },
  { varName: "EMAIL_FROM_NAME", key: "fromName", group: "email", label: "Nombre del remitente (aparece en los correos)", type: "text", placeholder: "Mi Negocio" },
  { varName: "ALERT_EMAIL_TO", key: "alertEmailTo", group: "email", label: "Correo que recibe las alertas", type: "text", placeholder: "yo@negocio.com" },
  { varName: "WA_PHONE_NUMBER_ID", key: "waPhoneNumberId", group: "whatsapp", label: "ID del número de teléfono", type: "text", placeholder: "1xxxxxxxxxx" },
  { varName: "WA_BUSINESS_ACCOUNT_ID", key: "waBusinessAccountId", group: "whatsapp", label: "ID de la cuenta (WABA)", type: "text", placeholder: "1xxxxxxxxxx" },
  { varName: "WA_ACCESS_TOKEN", key: "waAccessToken", group: "whatsapp", label: "Token de acceso (empieza con EAAG…)", type: "password" },
  { varName: "WA_APP_SECRET", key: "waAppSecret", group: "whatsapp", label: "App secret de la app de Meta", type: "password" },
  { varName: "WA_WEBHOOK_VERIFY_TOKEN", key: "waWebhookVerifyToken", group: "whatsapp", label: "Token de verificación del webhook", type: "password" },
  { varName: "WA_GRAPH_VERSION", key: "waGraphVersion", group: "whatsapp", label: "Versión de Graph API", type: "text", placeholder: "v24.0" },
  { varName: "TELEGRAM_BOT_TOKEN", key: "telegramBotToken", group: "telegram", label: "Token del bot de Telegram", type: "password" },
  { varName: "TELEGRAM_CHAT_ID", key: "telegramChatId", group: "telegram", label: "Chat ID de Telegram", type: "text" },
];

/**
 * Devuelve la configuración efectiva: lo guardado en la BD (si existe) sobre
 * el valor del .env. Lectura fresca en cada llamada para que los cambios que
 * se hagan desde la web surtan efecto sin reiniciar el servidor.
 */
export async function getConfig(): Promise<Env> {
  const env = getEnv();
  let db: Record<string, string> = {};
  try {
    await initPragmas();
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
    db = Object.fromEntries(rows.map((r) => [r.key.slice(PREFIX.length), r.value]));
  } catch {
    // La BD aún no está lista (migración pendiente): solo usamos el .env
  }

  const out = { ...env } as Env;
  for (const [varName, key] of Object.entries(VAR_TO_KEY) as [ConfigVar, EnvKey][]) {
    const value = db[varName];
    if (value === undefined || value === null || value.trim() === "") continue;
    (out as Record<string, unknown>)[key] = NUMERIC_KEYS.has(key) ? Number(value) : value;
  }
  return out;
}

/**
 * Guarda valores desde la web. Solo se escriben los que vengan no vacíos;
 * un campo vacío significa "dejar el valor actual".
 */
export async function saveConfig(values: Record<string, string>): Promise<string[]> {
  await initPragmas();
  const saved: string[] = [];
  for (const [varName, raw] of Object.entries(values)) {
    if (!(varName in VAR_TO_KEY)) continue;
    const value = raw.trim();
    if (!value) continue;
    await prisma.setting.upsert({
      where: { key: PREFIX + varName },
      update: { value },
      create: { key: PREFIX + varName, value },
    });
    saved.push(varName);
  }
  return saved;
}

export function maskSecret(value: string): string {
  if (!value) return "";
  return value.length <= 6 ? "••••••" : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export interface ConfigModel {
  email: {
    imapHost: string;
    imapPort: string;
    imapUser: string;
    imapPassword: string;
    imapLookbackDays: string;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPassword: string;
    fromName: string;
    alertEmailTo: string;
  };
  whatsapp: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    appSecret: string;
    webhookVerifyToken: string;
    graphVersion: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
  slaThresholdMinutes: number;
  configured: {
    imap: boolean;
    smtp: boolean;
    whatsapp: boolean;
    telegram: boolean;
  };
}

/**
 * Modelo para la UI: valores no sensibles completos, secretos enmascarados,
 * y un flag "configured" por conexión.
 */
export async function getConfigModel(): Promise<ConfigModel> {
  const cfg = await getConfig();
  const thresholdSetting = await prisma.setting
    .findUnique({ where: { key: "sla.threshold.minutes" } })
    .catch(() => null);

  return {
    email: {
      imapHost: cfg.imapHost,
      imapPort: String(cfg.imapPort),
      imapUser: cfg.imapUser,
      imapPassword: maskSecret(cfg.imapPassword),
      imapLookbackDays: String(cfg.imapLookbackDays),
      smtpHost: cfg.smtpHost,
      smtpPort: String(cfg.smtpPort),
      smtpUser: cfg.smtpUser,
      smtpPassword: maskSecret(cfg.smtpPassword),
      fromName: cfg.fromName,
      alertEmailTo: cfg.alertEmailTo,
    },
    whatsapp: {
      phoneNumberId: cfg.waPhoneNumberId,
      businessAccountId: cfg.waBusinessAccountId,
      accessToken: maskSecret(cfg.waAccessToken),
      appSecret: maskSecret(cfg.waAppSecret),
      webhookVerifyToken: maskSecret(cfg.waWebhookVerifyToken),
      graphVersion: cfg.waGraphVersion,
    },
    telegram: {
      botToken: maskSecret(cfg.telegramBotToken),
      chatId: cfg.telegramChatId,
    },
    slaThresholdMinutes: thresholdSetting ? Number(thresholdSetting.value) || cfg.slaThresholdMinutes : cfg.slaThresholdMinutes,
    configured: {
      imap: Boolean(cfg.imapUser && cfg.imapPassword),
      smtp: Boolean(cfg.smtpUser && cfg.smtpPassword),
      whatsapp: Boolean(cfg.waPhoneNumberId && cfg.waAccessToken),
      telegram: Boolean(cfg.telegramBotToken && cfg.telegramChatId),
    },
  };
}