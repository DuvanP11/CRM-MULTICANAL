# Configurar Gmail (IMAP/SMTP)

El CRM lee tus correos entrantes por IMAP y responde por SMTP usando la misma
cuenta de Gmail. **No uses tu contraseña normal**: Google exige una
*contraseña de aplicación*.

## Paso 1: Activa la verificación en 2 pasos (obligatorio)

1. Entra a tu cuenta de Google → https://myaccount.google.com/security
2. Activa **Verificación en 2 pasos** si no la tienes.
3. Sin esto, no puedes crear una contraseña de aplicación.

## Paso 2: Crea una contraseña de aplicación

1. Ve a https://myaccount.google.com/apppasswords
2. Elige una app: **Correo**, y dispositivo: **Otro** → escribe `crm-wa`.
3. Google te da una contraseña de **16 caracteres** sin espacios:

```
abcd efgh ijkl mnop
```

4. Guárdala: **nunca la compartas y no la subas al repo**.

## Paso 3: Verifica que IMAP está activado

1. https://mail.google.com/mail/u/0/#settings/fwdandpop
2. En "Acceso POP e IMAP" → **Habilitar IMAP**.

## Paso 4: Rellena el `.env`

```dotenv
EMAIL_IMAP_HOST="imap.gmail.com"
EMAIL_IMAP_PORT="993"
EMAIL_IMAP_USER="tucorreo@gmail.com"
EMAIL_IMAP_PASSWORD="abcd efgh ijkl mnop"   # contraseña de aplicación

EMAIL_SMTP_HOST="smtp.gmail.com"
EMAIL_SMTP_PORT="465"
EMAIL_SMTP_USER="tucorreo@gmail.com"
EMAIL_SMTP_PASSWORD="abcd efgh ijkl mnop"   # la misma
EMAIL_FROM_NAME="Nombre de tu negocio"
```

> **Outlook/Microsoft 365**: usa `outlook.office365.com` (IMAP) y
> `smtp.office365.com` (SMTP). El JD de puertos igual.
> **Zoho**: `imap.zoho.com` / `smtp.zoho.com`.

## Paso 5: Prueba

Desde los Ajustes del CRM pulsa **Probar IMAP** y **Probar SMTP**. Después
envía un correo a tu Gmail desde otra cuenta: debería aparecer en el dashboard
en menos de 1 minuto.

## Solución de problemas

| Error | Causa / Solución |
|---|---|
| `534` o error de autenticación | No es la contraseña normal: usa la **contraseña de aplicación**. Revisa que pasaste la contraseña con espacios o sin ellos de forma correcta. |
| `IMAP no configurado` | Faltan `EMAIL_IMAP_USER` / `EMAIL_IMAP_PASSWORD` en `.env`. |
| Google bloquea "aplicación menos segura" | Con contraseña de aplicación + 2FA no debería ocurrir. Revisa la actividad reciente de seguridad de tu cuenta. |
| No aparecen correos | El primer sync depende de `EMAIL_IMAP_LOOKBACK_DAYS` (default 30). Verifica el log del worker `npm run dev:email`. |