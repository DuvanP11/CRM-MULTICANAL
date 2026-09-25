# Guía de instalación para el comprador

Esta guía permite poner en marcha CRM-WA (el CRM de Email + WhatsApp) en tu
propio negocio, **sin publicar nada en App Store ni Play Store** (se instala
como app desde el navegador).

---

## Qué necesitas

| Elemento | Detalle |
|---|---|
| Un Mac o PC | Cualquier máquina con macOS/Windows/Linux y Node.js ≥ 20 |
| Node.js | https://nodejs.org (versión LTS) |
| ngrok | https://ngrok.com (solo para probar en local el WhatsApp) |
| Correo de negocio | Gmail, Outlook o Zoho con acceso IMAP |
| Número de WhatsApp Business | API de Meta (n° de prueba al empezar) |
| Cuenta de Telegram | Opcional, para las alertas al móvil |

---

## Paso 1: Preparar el correo

Sigue `setup-gmail.md`: activa la verificación en 2 pasos en tu Gmail y crea
una **contraseña de aplicación** para IMAP/SMTP.

## Paso 2: Preparar WhatsApp

Sigue `setup-meta.md`: ten claro el *phone number ID*, el *app secret*, el
*access token* y un *verify token* propio.

## Paso 3: Instalar la aplicación

```bash
# 1) Descarga/descomprime el proyecto
cd crm-wa

# 2) Instala dependencias
npm install

# 3) Crea las variables de entorno
cp .env.example .env
#   → rellena EMAIL_IMAP_USER/PASSWORD, WA_*, NEXTAUTH_SECRET, ADMIN_EMAIL...

# 4) Crea la base de datos
npm run prisma:migrate

# 5) Crea el usuario admin
npm run seed          # contraseña temporal: admin1234

# 6) Arranca todo (web + email + alertas)
npm run dev:all
```

Abre http://localhost:3000 e inicia sesión.

> Para producción local, en lugar de `dev:all` usa el administrador de
> procesos **PM2**:
> ```bash
> npm install -g pm2
> pm2 start "npm run start" --name web
> pm2 start "tsx src/workers/email-sync.ts" --name email
> pm2 start "tsx src/workers/alert-worker.ts" --name alerts
> pm2 save && pm2 startup
> ```

## Paso 4: Instalar como app (PWA)

- **En el móvil (iOS/Safari)**: abre http://localhost:3000 → botón Compartir →
  **Añadir a pantalla de inicio**.
- **En el móvil (Android/Chrome)**: abre la URL → menú → **Instalar app**.
- **En el PC (Chrome)**: icono de instalar en la barra de direcciones.

Se crea un icono en tu pantalla que abre la app a pantalla completa.

## Paso 5: Configurar el webhook de WhatsApp

1. `ngrok http 3000` → copia la URL.
2. En Meta, el webhook apunte a `https://tu-url/api/whatsapp/webhook` con tu
   verify token (ver `ngrok-local.md`).

## Paso 6: Configurar alertas (opcional pero recomendado)

### Email de alerta

```dotenv
ALERT_EMAIL_TO="tucorreo@negocio.com"   # a dónde llegan las alertas
SLA_THRESHOLD_MINUTES="30"              # umbral de respuesta
```

### Telegram

1. Habla con **@BotFather** → `/newbot` → crea el bot y copia el token.
2. Escribe a tu bot y luego consulta tu `chat_id`:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   ```
3. Rellena:
   ```dotenv
   TELEGRAM_BOT_TOKEN="123456:ABC..."
   TELEGRAM_CHAT_ID="987654321"
   ```

## Uso diario

- **Dashboard**: contactos, conversaciones abiertas, alertas y promedio de
  tiempo de primera respuesta.
- **Sin responder**: lista de conversaciones que superan el umbral SLA, con el
  tiempo transcurrido (y marcado en rojo si pasó 2×).
- **Conversación**: responde por el mismo canal por el que te escribieron.
- **Ajustes**: cambia el umbral SLA y prueba las conexiones.

## Despliegue en la nube (Vercel)

Ver `docs/despliegue-vercel.md`. La base ya es **PostgreSQL**, así que solo
creas la base en Neon/Supabase, defines `DATABASE_URL` y ejecutas `npm run setup`
una vez. Recomendado cuando no quieras depender de un ordenador encendido.

## Copias de seguridad

La base es **PostgreSQL** (Neon en producción). Los respaldos se hacen desde el
proveedor, no desde un archivo local:

- **Neon**: plan gratuito con *branching* y point-in-time recovery; además
  `pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump`.
- **Supabase**: respaldos automáticos en el panel + downloadable desde
  *Database → Backups*.

```bash
# Respaldo manual genérico (necesita el cliente psql instalado)
pg_dump "$DATABASE_URL" -Fc -f "backup-$(date +%F).dump"
```

---

¿Problemas? Revisa los logs: `npm run dev:email` y `npm run dev:alerts`
muestran el estado de la conexión con el correo y las alertas.