function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function getEnv() {
  return {
    databaseUrl: required("DATABASE_URL"),
    nextAuthUrl: optional("NEXTAUTH_URL", "http://localhost:3000"),
    nextAuthSecret: required("NEXTAUTH_SECRET"),
    adminEmail: optional("ADMIN_EMAIL"),
    adminPasswordHashB64: optional("ADMIN_PASSWORD_HASH_B64"),

    imapHost: optional("EMAIL_IMAP_HOST", "imap.gmail.com"),
    imapPort: Number(optional("EMAIL_IMAP_PORT", "993")),
    imapUser: optional("EMAIL_IMAP_USER"),
    imapPassword: optional("EMAIL_IMAP_PASSWORD"),
    imapSyncIntervalMs: Number(optional("EMAIL_IMAP_SYNC_INTERVAL_MS", "30000")),
    imapLookbackDays: Number(optional("EMAIL_IMAP_LOOKBACK_DAYS", "30")),

    smtpHost: optional("EMAIL_SMTP_HOST", "smtp.gmail.com"),
    smtpPort: Number(optional("EMAIL_SMTP_PORT", "465")),
    smtpUser: optional("EMAIL_SMTP_USER"),
    smtpPassword: optional("EMAIL_SMTP_PASSWORD"),
    fromName: optional("EMAIL_FROM_NAME", "Mi Negocio"),

    slaThresholdMinutes: Number(optional("SLA_THRESHOLD_MINUTES", "30")),
    alertCheckIntervalMs: Number(optional("ALERT_CHECK_INTERVAL_MS", "60000")),
    alertEmailTo: optional("ALERT_EMAIL_TO"),
    telegramBotToken: optional("TELEGRAM_BOT_TOKEN"),
    telegramChatId: optional("TELEGRAM_CHAT_ID"),

    waPhoneNumberId: optional("WA_PHONE_NUMBER_ID"),
    waBusinessAccountId: optional("WA_BUSINESS_ACCOUNT_ID"),
    waAccessToken: optional("WA_ACCESS_TOKEN"),
    waAppSecret: optional("WA_APP_SECRET"),
    waWebhookVerifyToken: optional("WA_WEBHOOK_VERIFY_TOKEN"),
    waGraphVersion: optional("WA_GRAPH_VERSION", "v24.0"),
  };
}

export type Env = ReturnType<typeof getEnv>;