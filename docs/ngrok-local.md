# Probar el webhook de WhatsApp en local (ngrok)

El webhook de Meta necesita una URL **pública HTTPS** para enviarte los
mensajes entrantes. En tu Mac, `ngrok` crea un túnel temporal hacia
`localhost:3000`.

## Instalar ngrok

```bash
brew install ngrok
ngrok config add-authtoken TU_TOKEN   # una vez, gratis en ngrok.com
```

## Usarlo

1. Arranca la app: `npm run dev:all`
2. En otra terminal:

```bash
ngrok http 3000
```

3. Copia la URL `https://xxxx.ngrok-free.app` que muestra ngrok.
4. En Meta (`docs/setup-meta.md` paso 6) común el webhook:
   - Callback: `https://xxxx.ngrok-free.app/api/whatsapp/webhook`
   - Verify token: el valor de `WA_WEBHOOK_VERIFY_TOKEN`

## Importante

- Cada vez que reinicias ngrok gratis, **cambia la URL** → debes volver a
  actualizarla en Meta (tarda menos de 1 minuto).
- Para estabilidad puedes crear un **dominio estático** de pago
  (`ngrok http --url=tucrm.ngrok.app 3000`), que no cambia.
- En producción (Vercel) la URL es fija (`https://tu-dominio`), así que este
  problema desaparece.

## Verificar que llegan los eventos

El log de `npm run dev:web` mostrará líneas como:

```
✅ Webhook de WhatsApp verificado por Meta.
✅ Webhook procesado: 1 mensaje(s).
```

Si no aparece nada, revisa:
- Que en Meta el campo **messages** esté suscrito.
- Que `WA_APP_SECRET` sea el de la app (no el token).
- Que el verify token coincida exactamente.