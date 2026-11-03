// nodemailer 10 movió los tipos a named exports (`nodemailer.Transporter` ya no
// existe como namespace) y es ESM-first con build CJS incluido.
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { getConfig } from "@/lib/config";

export function createTransport(cfg: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
}): Transporter {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPassword,
    },
  });
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
}

export async function sendEmail(input: SendEmailInput) {
  const cfg = await getConfig();
  if (!cfg.smtpUser || !cfg.smtpPassword) {
    throw new Error("SMTP no configurado: completa la configuración desde Ajustes");
  }
  const transport = createTransport(cfg);

  const message: SendMailOptions = {
    from: `"${cfg.fromName}" <${cfg.smtpUser}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
  };

  if (input.inReplyTo) {
    message.inReplyTo = input.inReplyTo;
    message.references = input.references || input.inReplyTo;
  }

  const info = await transport.sendMail(message);
  return info.messageId;
}