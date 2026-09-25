# CRM Multicanal · Email + WhatsApp

CRM pequeño que unifica **email** (IMAP/SMTP) y **WhatsApp Business API** en
conversaciones por contacto, con **motor de SLA** (tiempo hasta la primera
respuesta), **alertas multicanal** (dashboard + email + Telegram) cuando hay
mensajes sin responder, y un **dashboard de analítica** con gráficos propios.

Se despliega en **Vercel** y se instala como **app** en el móvil y escritorio.

## Funcionalidades

- 📬 Email entrante vía IMAP (Gmail, Outlook, Zoho) y saliente vía SMTP
- 💬 WhatsApp entrante vía webhook de Meta (firma HMAC verificada) y saliente vía Graph API
- 🧑 Contactos unificados: el mismo cliente se identifica por email o WhatsApp
- ⏱ Motor de SLA: mide el tiempo inbound → primera respuesta del agente
- 🔔 Alertas cuando un mensaje supera el umbral sin responder: dashboard + email + Telegram, con escalamiento (2× umbral)
- 📊 Analítica: tendencia diaria, canales, primera respuesta, cumplimiento de SLA y top clientes
- 📱 Instalable como app: **PWA** en iPhone/iPad (Añadir a pantalla de inicio) y **APK** en Android (TWA)
- 🔐 Una cuenta admin
- 🎨 Temas claro/oscuro y branding corporativo (logo y colores) en `/design`

## Stack

- Next.js 14 (App Router) + TypeScript
- **PostgreSQL** con Prisma (Neon en producción; compatible con Supabase/Railway)
- imapflow (IMAP), nodemailer (SMTP), next-auth (login), mailparser
- Meta Cloud API (WhatsApp)

> La base ya es PostgreSQL porque **Vercel no admite SQLite**: su filesystem es
> efímero y de solo lectura, así que un archivo `.db` se perdería en cada
> despliegue y no se escribiría entre invocaciones.

## Requisitos

- Node.js ≥ 20
- npm
- Una base PostgreSQL (plan gratuito en [Neon](https://neon.tech) sirve de sobra)
- ngrok (para probar el webhook de WhatsApp en local)
- Una cuenta Gmail (o cualquier correo con acceso IMAP) y una **contraseña de aplicación**
- Acceso a **Meta Cloud API** con un número de WhatsApp Business

## Arranque rápido

```bash
npm install
cp .env.example .env
# 1) Pega tu DATABASE_URL de Postgres y define NEXTAUTH_SECRET
# 2) Crea el esquema y el admin con contraseña temporal:
npm run setup
# 3) Arranca:
npm run dev:all      # web (3000) + worker email + worker alertas
```

Abre http://localhost:3000 → login con `admin@crm.local` / `admin1234`.

> ⚠️ **Esa contraseña es de prueba y es pública** (está en el README y en el
> código). Cámbiala en cuanto entres, en `/settings`. Ver
> [docs/credenciales.md](docs/credenciales.md).

## Scripts

| Comando | Función |
|---|---|
| `npm run dev:web` | App web (Next.js) |
| `npm run dev:email` | Worker de sync IMAP |
| `npm run dev:alerts` | Worker de alertas SLA |
| `npm run dev:all` | Los tres a la vez |
| `npm run prisma:migrate` | Crear/aplicar migración en desarrollo |
| `npm run db:deploy` | Aplicar migraciones ya existentes (producción) |
| `npm run setup` | `db:deploy` + seed del admin (**usar tras clonar**) |
| `npm run seed` | Crear admin y datos demo |
| `npm run demo` | Solo datos demo de ejemplo |
| `npm run prisma:studio` | Ver la BD en el navegador |
| `npm run typecheck` / `lint` / `build` | Verificaciones |

## Despliegue en Vercel

Guía paso a paso: **[docs/despliegue-vercel.md](docs/despliegue-vercel.md)**.

Resumen:

1. Crea la base en [Neon](https://neon.tech) y copia su **connection string**.
2. En Vercel: importa el repo, define `DATABASE_URL`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL` y `CRON_SECRET`.
3. Antes del primer deploy, aplica el esquema y crea el admin desde tu máquina:
   `npm run setup`.
4. `vercel.json` ya define los crons: sync de email (`*/5 * * * *`) y revisión
   de alertas (`* * * * *`).
5. Para WhatsApp en producción: apunta el webhook (Callback URL) de Meta a
   `https://tu-dominio/api/whatsapp/webhook`.

> Los crons de Vercel requieren plan Pro o superior. En Hobby, el sync se puede
> disparar manualmente con `GET /api/cron/email-sync` (header
> `Authorization: Bearer <CRON_SECRET>`).

## Instalar como app

- **iPhone / iPad / escritorio**: es una PWA. En Safari, *Compartir → Añadir a
  pantalla de inicio*. En Chrome/Edge, el ícono de instalar en la barra de
  direcciones. iOS no permite instalar APKs; esto es el equivalente nativo.
- **Android**: la misma PWA se puede empaquetar como APK firmado con
  [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).
  Guía: **[docs/apk-android.md](docs/apk-android.md)**.

## Documentación

- [Desplegar en Vercel + Neon](docs/despliegue-vercel.md)
- [Instalar como APK en Android](docs/apk-android.md)
- [Instalar como app en iPhone/iPad (PWA)](docs/pwa-instalar.md)
- [Credenciales y acceso de prueba](docs/credenciales.md)
- [Configurar Gmail (IMAP/SMTP + contraseña de aplicación)](docs/setup-gmail.md)
- [Configurar WhatsApp Business API (Meta)](docs/setup-meta.md)
- [Probar el webhook en local con ngrok](docs/ngrok-local.md)
- [Guía de instalación para el comprador](docs/guia-instalacion.md)

## Licencia

Uso comercial permitido por el dueño del proyecto.