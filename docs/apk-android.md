# Generar el APK para Android

La app ya es una **PWA** instalable. En Android, un **APK** es simplemente esa
PWA empaquetada en un *Trusted Web Activity* (TWA): un contenedor nativo que
muestra el sitio a pantalla completa, sin barra de dirección.

> **iPhone:** los APK no se instalan en iOS, es una restricción de Apple. Para
> iPhone/iPad usa la PWA (ver [pwa-instalar.md](pwa-instalar.md)), que se instala
> desde Safari y se comporta igual: ícono propio, pantalla completa y sin barra.

Alternativa sin código: [PWABuilder](https://www.pwabuilder.com) sube la URL de
tu despliegue y genera el APK y el bundle de Play Store. La guía de abajo es la
vía con Bubblewrap, que además controlas tú.

---

## 0. Requisitos

- Node.js ≥ 20
- JDK 17 o superior (`java -version`)
- Android SDK con `platform-tools` y `build-tools` en el PATH
- El CRM **publicado en un dominio HTTPS** (Vercel sirve HTTPS por defecto; los
  APK no admiten `http://`)

---

## 1. Generar el proyecto con Bubblewrap

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://TU-DOMINIO/manifest.webmanifest
```

Responde con el package name sugerido, por ejemplo `com.tuempresa.crm`.

---

## 2. Fingerprint del certificado

El APK se firma con una clave local. Google necesita su huella SHA-256 para
vincular el dominio con la app:

```bash
keytool -list -v -keystore ~/upload-keystore.jks -alias upload | grep "SHA256:"
```

Copia el valor que empieza por `AB:CD:...` y defínelo en Vercel:

| Variable | Valor |
|---|---|
| `ANDROID_PACKAGE_NAME` | `com.tuempresa.crm` |
| `ANDROID_SHA256_CERT` | `AB:CD:EF:...` (la huella del paso anterior) |

La app sirve ese par en `/.well-known/assetlinks.json`, y **de nada sirve si
Chrome no puede verificarlo**. Compruébalo antes de seguir: en el despliegue
debe aparecer el array con tu paquete y huella. Si sale `[]`, faltan las
variables.

Verifícalo también con la herramienta de Google:
<https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=TU-DOMINIO>

---

## 3. Editar `twa-manifest.json`

```json
{
  "packageId": "com.tuempresa.crm",
  "host": "TU-DOMINIO",
  "appVersionName": "1.0.0",
  "launcherName": "CRM Multicanal",
  "display": "standalone",
  "startUrl": "/dashboard",
  "backgroundColor": "#f5f6f8",
  "themeColor": "#111827",
  "navigationColor": "#111827",
  "iconUrl": "https://TU-DOMINIO/icons/icon-512.png",
  "maskableIconUrl": "https://TU-DOMINIO/icons/icon-maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "appBoundApiKey": ""
}
```

`startUrl` debe ser una ruta **dentro** del sitio. Este CRM manda a
`/dashboard` porque `/` redirige según la sesión.

---

## 4. Construir el APK

```bash
bubblewrap build            # genera un APK de prueba en ./twa-build/
bubblewrap build --release  # APK firmado para distribuir
```

`bubblewrap build` produce `app-release-signed.apk` si la clave de *upload*
existe. Instálalo en un teléfono conectado por USB con:

```bash
adb install -r app-release-signed.apk
```

O cópialo al teléfono y ábrelo (permite "instalar apps de orígenes desconocidos").

---

## 5. Publicar en Play Store (opcional)

`bubblewrap build --release` deja además un `.aab`, que es lo que quiere Google
Play. Súbelo en Play Console → *App nueva*. No es necesario para instalar el
APK a mano.

---

## 6. Mantener el APK al día

- El contenido de la app se actualiza solo: es el sitio web, no el APK.
- Solo hay que reconstruir si cambian `packageId`, `startUrl` o los iconos.
- Cada cambio en `ANDROID_SHA256_CERT` (por ejemplo, al pasar a la clave de
  *upload* de Play) se resuelve **sin recompilar**: la ruta lee la variable en
  cada request.

---

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| Chrome muestra la barra de URL | `assetlinks.json` no coincide: revisa package, huella y que el sitio sea HTTPS |
| Pantalla en blanco al abrir | `startUrl` apunta a una ruta inexistente o la sesión no está iniciada |
| El ícono sale recortado en el launcher | Falta `maskableIconUrl` |
| `bubblewrap` no encuentra el SDK | `ANDROID_HOME` sin exportar en el PATH |
| La app abre y cierra | Falta internet; el APK no guarda copia del HTML a propósito |

> **Sobre el service worker:** este CRM cachea **solo** estáticos (bundle,
> iconos, manifest). Las conversaciones y respuestas nunca se guardan en el
> dispositivo, ni siquiera sin conexión. Es deliberado: son datos de clientes.
> Ver el comentario al inicio de `public/sw.js`.
