# Configurar WhatsApp Business API (Meta)

El CRM usa la **Meta Cloud API** para recibir mensajes (webhook) y enviarlos
(Graph API). Requiere una cuenta de negocio de Meta con un número de WhatsApp.

---

## Requisitos previos

- Un número de **WhatsApp Business API** (distinto de tu WhatsApp personal).
  Puede ser un número nuevo o el número de tu negocio.
- Una cuenta en [business.facebook.com](https://business.facebook.com).
- El **personal de Meta** debe estar verificado (puede tardar días; para
  probar bastan los permisos de desarrollo).

---

## Paso 1: Crear la app en Meta for Developers

1. Entra en https://developers.facebook.com/apps
2. **Create App** → *Other* → **Business**.
3. Simpla "WhatsApp" como producto y guárdala.

## Paso 2: Configurar WhatsApp en la app

1. Panel de la app → **WhatsApp** → *API Setup*.
2. Ahí encuentras el **Test number** (un número temporal de prueba) y los
   **tokens** provisionales. Para producción se usa tu número real.
3. Anota el **Phone number ID** y el **WhatsApp Business Account ID**.

## Paso 3: Token permanente (recomendado)

Los tokens de la app **caducan** (~24 h). Para no depender de ellos:

1. En Business Manager: *Settings → Users → System users*.
2. Crea un system user y dale permiso *WhatsApp Business Account* (gestionar).
3. **Generate token** de ese usuario (sin caducidad, configura el mayor
   periodo posible) con los permisos: `whatsapp_business_messaging`,
   `whatsapp_business_management`.
4. Copia el token en `WA_ACCESS_TOKEN`.

## Paso 4: App secret

1. Panel de la app → *Settings → Basic*.
2. Copia el **App secret** a `WA_APP_SECRET`.
3. Crea un `WA_WEBHOOK_VERIFY_TOKEN` propio (texto que tú inventes, p.ej.
   `mi-crm-verifica-123`).

## Paso 5: Rellena `.env`

```dotenv
WA_PHONE_NUMBER_ID="123456789012345"
WA_BUSINESS_ACCOUNT_ID="987654321098765"
WA_ACCESS_TOKEN="EAAG...."          # token del system user
WA_APP_SECRET="a1b2c3d4..."
WA_WEBHOOK_VERIFY_TOKEN="mi-crm-verifica-123"
WA_GRAPH_VERSION="v24.0"
```

## Paso 6: Conectar el webhook (con ngrok en local)

1. Abre un túnel con `ngrok http 3000` (ver `docs/ngrok-local.md`) y copia la
   URL `https://xxxx.ngrok-free.app`.
2. En Meta: **WhatsApp → Configuration → Webhook**:
   - *Callback URL*: `https://xxxx.ngrok-free.app/api/whatsapp/webhook`
   - *Verify token*: `mi-crm-verifica-123` (el de `WA_WEBHOOK_VERIFY_TOKEN`)
3. Pulsa **Verify and save** y suscríbete al campo **messages**.

## Paso 7: Probar

1. Envía un mensaje de WhatsApp normal a tu número de negocio.
2. Debe aparecer en el CRM en segundos.
3. Responde desde el CRM: el contacto debería recibirlo.

---

## Límites importantes de Meta

- **Ventana de 24 horas**: tras un mensaje del cliente, puedes responder texto
  libre durante 24 h. Pasado ese tiempo, Meta exige un **template aprobado**.
- **Rate limits**: ~80 mensajes/segundo por número; límites por conversaciones
  iniciadas por el negocio. El CRM no fuerza reintentos; evita envíos masivos.
- **Número de prueba** (test number): solo puede enviar a teléfonos
  registrados en tu cuenta de Meta, no a cualquiera.

## Verificación del negocio

Para enviar a clientes reales necesita:
- Verificar el negocio en Meta (permisos comerciales).
- Adicionar tu número real (no el de prueba) y verificar tu sitio web/negocio.
- Puede tardar varios días. El desarrollo y pruebas pueden hacerse con el
  número de prueba.

Más información oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/overview