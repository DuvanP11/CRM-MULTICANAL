"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ChannelLogo from "@/components/channel-logo";

type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "password" | "number";
  placeholder?: string;
};

type Model = {
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
};

const EMAIL_FIELDS: FieldDef[] = [
  { name: "EMAIL_IMAP_HOST", label: "Host IMAP", placeholder: "imap.gmail.com" },
  { name: "EMAIL_IMAP_PORT", label: "Puerto IMAP", type: "number", placeholder: "993" },
  { name: "EMAIL_IMAP_USER", label: "Usuario IMAP (tu correo)", placeholder: "correo@gmail.com" },
  { name: "EMAIL_IMAP_PASSWORD", label: "Contraseña de aplicación (IMAP)", type: "password" },
  { name: "EMAIL_IMAP_LOOKBACK_DAYS", label: "Días hacia atrás en el primer sync", type: "number", placeholder: "30" },
  { name: "EMAIL_SMTP_HOST", label: "Host SMTP", placeholder: "smtp.gmail.com" },
  { name: "EMAIL_SMTP_PORT", label: "Puerto SMTP", type: "number", placeholder: "465" },
  { name: "EMAIL_SMTP_USER", label: "Usuario SMTP (tu correo)", placeholder: "correo@gmail.com" },
  { name: "EMAIL_SMTP_PASSWORD", label: "Contraseña de aplicación (SMTP)", type: "password" },
  { name: "EMAIL_FROM_NAME", label: "Nombre del remitente", placeholder: "Mi Negocio" },
  { name: "ALERT_EMAIL_TO", label: "Correo que recibe las alertas SLA", placeholder: "yo@negocio.com" },
];

const WHATSAPP_FIELDS: FieldDef[] = [
  { name: "WA_PHONE_NUMBER_ID", label: "ID del número de teléfono", placeholder: "1xxxxxxxxxx" },
  { name: "WA_BUSINESS_ACCOUNT_ID", label: "ID de la cuenta (WABA)", placeholder: "1xxxxxxxxxx" },
  { name: "WA_ACCESS_TOKEN", label: "Token de acceso (EAAG…)", type: "password" },
  { name: "WA_APP_SECRET", label: "App secret de la app de Meta", type: "password" },
  { name: "WA_WEBHOOK_VERIFY_TOKEN", label: "Token de verificación del webhook", type: "password" },
  { name: "WA_GRAPH_VERSION", label: "Versión de Graph API", placeholder: "v24.0" },
];

const TELEGRAM_FIELDS: FieldDef[] = [
  { name: "TELEGRAM_BOT_TOKEN", label: "Token del bot de Telegram", type: "password" },
  { name: "TELEGRAM_CHAT_ID", label: "Chat ID de Telegram", placeholder: "123456789" },
];

const EMAIL_NAMES = EMAIL_FIELDS.map((f) => f.name);
const WHATSAPP_NAMES = WHATSAPP_FIELDS.map((f) => f.name);
const TELEGRAM_NAMES = TELEGRAM_FIELDS.map((f) => f.name);

export default function SettingsPanel({ model }: { model: Model }) {
  const router = useRouter();
  const [slaMin, setSlaMin] = useState(model.slaThresholdMinutes);
  const [values, setValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<{ ok: boolean; text: string }[]>([]);
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setValue(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  function runAction(body: Record<string, unknown>, refresh = false) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (data?.actions) {
          setMessages(
            data.actions.map((a: { ok: boolean; test: string; error?: string }) => ({
              ok: a.ok,
              text: a.error ? `${a.test}: ${a.error}` : a.test,
            }))
          );
        }
        if (refresh) {
          setValues({});
          router.refresh();
        }
      } finally {
        setSavingTag(null);
      }
    });
  }

  function saveGroup(tag: string, names: string[]) {
    const config: Record<string, string> = {};
    for (const n of names) {
      if (values[n]?.trim()) config[n] = values[n].trim();
    }
    setSavingTag(tag);
    runAction({ config }, true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StatusBanner model={model} />

      {/* ---- SLA ---- */}
      <Card title="SLA — tiempo máximo sin respuesta">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSavingTag("sla");
            runAction({ slaThresholdMinutes: slaMin }, true);
          }}
          style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
        >
          <div style={{ flex: 1 }}>
            <FieldLabel>Minutos sin respuesta antes de alertar</FieldLabel>
            <input
              type="number"
              min={1}
              max={720}
              value={slaMin}
              onChange={(e) => setSlaMin(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={isPending} style={primaryBtn}>
            {savingTag === "sla" ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </Card>

      {/* ---- Correo ---- */}
      <Card
        title="Correo (IMAP / SMTP)"
        icon={<ChannelLogo channel="EMAIL" size={18} />}
        hint="Entrada = lo que llega. Salida = cómo respondes. El 'correo de alertas' recibe los avisos de SLA. Déjalo vacío si no quieres cambiarlo."
      >
        <SectionLabel>Entrada (IMAP) — idioma de los mensajes que llegan</SectionLabel>
        <Fields fields={EMAIL_FIELDS.slice(0, 5)} values={values} onChange={setValue} modelEmail={model.email} />
        <div style={{ height: 18 }} />
        <SectionLabel>Salida (SMTP) + alertas</SectionLabel>
        <Fields fields={EMAIL_FIELDS.slice(5)} values={values} onChange={setValue} modelEmail={model.email} />
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => saveGroup("email", EMAIL_NAMES)}
            disabled={isPending}
            style={primaryBtn}
          >
            {savingTag === "email" ? "Guardando…" : "Guardar correo"}
          </button>
          <TestButton label="Probar IMAP" onClick={() => runAction({ test: "imap" })} disabled={isPending} />
          <TestButton label="Probar SMTP" onClick={() => runAction({ test: "smtp" })} disabled={isPending} />
        </div>
      </Card>

      {/* ---- WhatsApp ---- */}
      <Card
        title="WhatsApp (Meta Cloud API)"
        icon={<ChannelLogo channel="WHATSAPP" size={18} />}
        hint="Pega los datos que obtuviste de Meta. El token de acceso debe tener permisos whatsapp_business_messaging."
      >
        <Fields fields={WHATSAPP_FIELDS} values={values} onChange={setValue} modelWhatsapp={model.whatsapp} />
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => saveGroup("whatsapp", WHATSAPP_NAMES)}
            disabled={isPending}
            style={primaryBtn}
          >
            {savingTag === "whatsapp" ? "Guardando…" : "Guardar WhatsApp"}
          </button>
          <TestButton label="Probar WhatsApp" onClick={() => runAction({ test: "whatsapp" })} disabled={isPending} />
        </div>
      </Card>

      {/* ---- Telegram ---- */}
      <Card
        title="Telegram (alertas al celular)"
        icon={<ChannelLogo channel="TELEGRAM" size={18} />}
        hint="Opcional. Crea un bot con @BotFather, copia su token y averigua tu chat ID con @userinfobot."
      >
        <Fields fields={TELEGRAM_FIELDS} values={values} onChange={setValue} modelTelegram={model.telegram} />
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => saveGroup("telegram", TELEGRAM_NAMES)}
            disabled={isPending}
            style={primaryBtn}
          >
            {savingTag === "telegram" ? "Guardando…" : "Guardar Telegram"}
          </button>
          <TestButton
            label="Probar Telegram"
            onClick={() => runAction({ test: "telegram" })}
            disabled={isPending}
          />
        </div>
      </Card>

      {messages.length > 0 && (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {messages.map((m, i) => (
            <li key={i} style={{ fontSize: 13, color: m.ok ? "var(--success)" : "var(--danger)" }}>
              {m.ok ? "✔ " : "✖ "}
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fields({
  fields,
  values,
  onChange,
  modelEmail,
  modelWhatsapp,
  modelTelegram,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (name: string, v: string) => void;
  modelEmail?: Model["email"];
  modelWhatsapp?: Model["whatsapp"];
  modelTelegram?: Model["telegram"];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
      {fields.map((f) => {
        const current = currentValue(f.name, modelEmail, modelWhatsapp, modelTelegram);
        return (
          <div key={f.name}>
            <FieldLabel>{f.label}</FieldLabel>
            <input
              type={f.type || "text"}
              name={f.name}
              autoComplete={f.type === "password" ? "new-password" : "off"}
              data-lpignore="true"
              value={values[f.name] ?? ""}
              placeholder={current || f.placeholder || ""}
              onChange={(e) => onChange(f.name, e.target.value)}
              style={inputStyle}
            />
            {current && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                Actual: <code>{current}</code>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function currentValue(
  name: string,
  email?: Model["email"],
  whatsapp?: Model["whatsapp"],
  telegram?: Model["telegram"]
): string {
  const map: Record<string, string | undefined> = {
    EMAIL_IMAP_HOST: email?.imapHost,
    EMAIL_IMAP_PORT: email?.imapPort,
    EMAIL_IMAP_USER: email?.imapUser,
    EMAIL_IMAP_PASSWORD: email?.imapPassword,
    EMAIL_IMAP_LOOKBACK_DAYS: email?.imapLookbackDays,
    EMAIL_SMTP_HOST: email?.smtpHost,
    EMAIL_SMTP_PORT: email?.smtpPort,
    EMAIL_SMTP_USER: email?.smtpUser,
    EMAIL_SMTP_PASSWORD: email?.smtpPassword,
    EMAIL_FROM_NAME: email?.fromName,
    ALERT_EMAIL_TO: email?.alertEmailTo,
    WA_PHONE_NUMBER_ID: whatsapp?.phoneNumberId,
    WA_BUSINESS_ACCOUNT_ID: whatsapp?.businessAccountId,
    WA_ACCESS_TOKEN: whatsapp?.accessToken,
    WA_APP_SECRET: whatsapp?.appSecret,
    WA_WEBHOOK_VERIFY_TOKEN: whatsapp?.webhookVerifyToken,
    WA_GRAPH_VERSION: whatsapp?.graphVersion,
    TELEGRAM_BOT_TOKEN: telegram?.botToken,
    TELEGRAM_CHAT_ID: telegram?.chatId,
  };
  return map[name] || "";
}

function StatusBanner({ model }: { model: Model }) {
  const items = [
    { label: "Correo entrante (IMAP)", ok: model.configured.imap, channel: "EMAIL" },
    { label: "Correo saliente (SMTP)", ok: model.configured.smtp, channel: "EMAIL" },
    { label: "WhatsApp (Meta)", ok: model.configured.whatsapp, channel: "WHATSAPP" },
    { label: "Telegram", ok: model.configured.telegram, channel: "TELEGRAM" },
  ];
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <ChannelLogo channel={it.channel} size={15} />
          <span>{it.label}</span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: it.ok ? "var(--success)" : "var(--muted)",
              display: "inline-block",
            }}
          />
          <span style={{ color: it.ok ? "var(--success)" : "var(--muted)" }}>{it.ok ? "✔" : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function Card({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: hint ? 2 : 16, display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        {title}
      </h2>
      {hint && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, marginTop: 0 }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "var(--muted)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--field-border)",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  background: "var(--field-bg)",
  color: "var(--field-fg)",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "var(--on-primary)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

function TestButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--card)",
        color: "var(--foreground)",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}