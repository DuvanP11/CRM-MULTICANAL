# Despliegue en Vercel + Neon

Guía paso a paso para publicar el CRM como página web. Tiempo estimado: 15 min.

## 0. Requisitos

- Una cuenta en [Vercel](https://vercel.com) (plan Hobby es suficiente para
  probar; los *crons* automáticos requieren Pro).
- Una base **PostgreSQL** en [Neon](https://neon.tech) (plan gratuito). Supabase
  o cualquier Postgres también valen: solo cambia la URL.

> La base ya es PostgreSQL en el repositorio. Antes era SQLite, que **no
> funciona en Vercel**: el filesystem del servidor es efímero y de solo lectura,
> así que el archivo se perdería en cada despliegue.

---

## 1. Crear la base en Neon

1. Entra en [console.neon.tech](https://console.neon.tech) → **Create Project**.
2. Nombre: `crm-multicanal`. Región: la más cercana a tus usuarios.
3. Neon abre la pantalla de conexión con un **connection string** parecido a:

```
postgresql://usuario:password@ep-xxxx-pooler.us-east-2.aws.neon.tech/crmdb?sslmode=require
```

4. Guárdalo: lo necesitarás en el paso 3.

> **Rama de desarrollo para trabajar en local:** en Neon, *Branches → Create
> branch → Development*. Genera una URL propia. Úsala como `DATABASE_URL` en tu
> `.env` local y así no tocas los datos de producción. En producción usa la
> rama `main` (sin el sufijo `-pooler` si no hace falta).

---

## 2. Subir el código

```bash
git clone https://github.com/DuvanP11/CRM-MULTICANAL.git
cd CRM-MULTICANAL
npm install
```

En Vercel: **Add New → Project → importa `DuvanP11/CRM-MULTICANAL`**. Vercel
detecta Next.js y no necesita configuración de framework. Puedes dejar el build
command por defecto porque `package.json` ya ejecuta `prisma generate` en
`postinstall` y en `build`.

---

## 3. Variables de entorno en Vercel

En **Project → Settings → Environment Variables** (marca *Production*,
*Preview* y *Development*):

| Variable | Valor | ¿Obligatoria? |
|---|---|---|
| `DATABASE_URL` | El connection string de Neon | **Sí** |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | **Sí** |
| `NEXTAUTH_URL` | `https://tu-dominio.vercel.app` | **Sí** |
| `CRON_SECRET` | `openssl rand -base64 32` | Recomendada |
| `ADMIN_EMAIL` | `admin@crm.local` (o el que quieras) | No |
| `ADMIN_PASSWORD_HASH_B64` | Ver [credenciales.md](credenciales.md) | No |
| `EMAIL_IMAP_*`, `EMAIL_SMTP_*` | Credenciales del correo | Para recibir/enviar email |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Credenciales de Telegram | Para alertas Telegram |
| `WA_*` | Credenciales de Meta Cloud API | Para WhatsApp |
| `SLA_THRESHOLD_MINUTES` | `30` | No |
| `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT` | Ver [apk-android.md](apk-android.md) | Solo si generas APK |

> `NEXTAUTH_SECRET` es obligatorio: `src/lib/env.ts` lanza error si falta, y sin
> él la sesión no se puede firmar.

---

## 4. Crear el esquema y el admin

El build de Vercel **no** toca la base a propósito (todas las rutas son
dinámicas), así que el esquema se aplica una vez desde tu máquina:

```bash
# .env local o variables exportadas con la URL de Neon
export DATABASE_URL="postgresql://..."
npm run setup     # = prisma migrate deploy + seed
```

Debes ver `✔ Admin configurado: admin@crm.local`.

---

## 5. Primer despliegue

1. Vercel despliega automáticamente al hacer push.
2. Cuando termine, entra en `https://tu-dominio.vercel.app/login`.
3. Inicia sesión con `admin@crm.local` / `admin1234`.
4. Cambia la contraseña en `/settings` cuanto antes.

### Comprobaciones

```bash
curl -s https://tu-dominio.vercel.app/api/health        # estado de la BD
curl -s https://tu-dominio.vercel.app/.well-known/assetlinks.json   # [] o el par del APK
```

Si `/api/health` responde `{"ok":true,...}` la base está conectada.

---

## 6. Crons

`vercel.json` ya define:

| Ruta | Frecuencia | Qué hace |
|---|---|---|
| `/api/cron/email-sync` | 1 vez al día en `vercel.json` (Hobby); cada 5 min con cron externo | Lee el buzón IMAP y crea conversaciones |
| `/api/cron/alerts` | 1 vez al día en `vercel.json` (Hobby); cada minuto con cron externo | Evalúa SLA y dispara alertas |

Ambos exigen el header `Authorization: Bearer <CRON_SECRET>` cuando
`CRON_SECRET` está definido (Vercel lo envía solo en despliegues Pro). Para
probarlos a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.vercel.app/api/cron/alerts
```

> **Hobby vs Pro:** en Hobby los crons no se ejecutan. Llévalos a Pro o
> dispara el endpoint a mano (o desde un cron externo gratuito como
> [cron-job.org](https://cron-job.org)).

---

## 7. WhatsApp en producción

1. En [developers.facebook.com](https://developers.facebook.com) crea la app.
2. En WhatsApp → *Configuración → Webhooks*, define **Callback URL**:
   `https://tu-dominio/api/whatsapp/webhook` y pon el mismo valor en
   `WA_WEBHOOK_VERIFY_TOKEN` en Vercel.
3. Suscríbete al campo `messages`.
4. Rellena `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET` y
   `WA_BUSINESS_ACCOUNT_ID`.
5. Nunca uses un token de la app de prueba: caduca en 24 h.

Detalle: [setup-meta.md](setup-meta.md).

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `Can't reach database server` | `DATABASE_URL` mal copiada o la rama de Neon está suspendida |
| `Falta variable de entorno: NEXTAUTH_SECRET` | No definiste `NEXTAUTH_SECRET` en Vercel |
| Login rejects la contraseña | No corriste `npm run setup`, o la BD no tiene el admin |
| El build falla con errores de Prisma | Falta `prisma generate`: revisa que `postinstall` exista en `package.json` |
| Los crons no llegan a dispararse | Plan Hobby, o falta `CRON_SECRET` |
| Los emails no entran | Contraseña de aplicación en vez de la normal, o IMAP bloqueado |


> **Hobby:** `vercel.json` trae un cron diario por endpoint porque Hobby rechaza el despliegue con crons más frecuentes. Para sincronizar de verdad, crea en cron-job.org dos tareas que llamen a ambos endpoints con `Authorization: Bearer <CRON_SECRET>` (email-sync cada 5 min, alerts cada minuto). En Pro puedes volver a poner `*/5 * * * *` y `* * * * *` en `vercel.json`.
