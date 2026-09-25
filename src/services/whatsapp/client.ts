import { getConfig } from "@/lib/config";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
  businessAccountId: string;
}

export async function getWaConfig(): Promise<WhatsAppConfig> {
  const cfg = await getConfig();
  if (!cfg.waPhoneNumberId || !cfg.waAccessToken) {
    throw new Error("WhatsApp no configurado: completa la configuración desde Ajustes");
  }
  return {
    phoneNumberId: cfg.waPhoneNumberId,
    accessToken: cfg.waAccessToken,
    graphVersion: cfg.waGraphVersion,
    businessAccountId: cfg.waBusinessAccountId,
  };
}

/**
 * Envía un mensaje de texto por Graph API. Devuelve el WAMID (id del mensaje).
 * Lanza Error con mensaje legible si Meta rechaza.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const config = await getWaConfig();

  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      }),
    });
  } catch (err) {
    throw new Error(`Error de red a Graph API: ${err instanceof Error ? err.message : err}`);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    // 470 = fuera de ventana de 24h / requiere template
    if (res.status === 470 || detail.includes("template")) {
      throw new Error(
        `Ventana de 24 horas cerrada: para responder fuera de la ventana se necesita una plantilla aprobada (${detail})`
      );
    }
    throw new Error(`Meta rechazó el mensaje (${detail})`);
  }

  const wamid: string | undefined = data?.messages?.[0]?.id;
  if (!wamid) {
    throw new Error("Meta no devolvió un id de mensaje");
  }

  return wamid;
}