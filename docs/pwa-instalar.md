# Instalar como app en iPhone, iPad, Mac y Windows

El CRM es una **PWA** (Progressive Web App): se instala desde el navegador, crea
su ícono en la pantalla de inicio y se abre a pantalla completa, sin barra de
direcciones y sin pasar por App Store ni Play Store.

> ¿Buscas un `.apk`? En **Android** sí se puede generar un APK real
> ([apk-android.md](apk-android.md)). En **iPhone no existe el APK**: iOS no
> permite instalar ese formato. La PWA de abajo es el equivalente nativo en
> iPhone y funciona igual o mejor.

## Requisitos

- Que el CRM esté publicado en **HTTPS** (Vercel lo da automáticamente; `ngrok`
  también sirve para probar en local).
- Safari en iOS/iPadOS. En Mac y Windows puede ser Chrome o Edge.

---

## iPhone / iPad

Safari es el único navegador que permite instalar una PWA en iOS.

1. Abre `https://TU-DOMINIO/login` en **Safari**.
2. Toca el botón **Compartir** (el cuadrado con flecha hacia arriba).
3. Baja hasta **Añadir a pantalla de inicio**.
4. Confirma con **Añadir**.

Aparece un ícono con el nombre *CRM Multicanal*. Al abrirlo:

- se ve a pantalla completa, sin barra de Safari;
- tiene su propio ícono y splash;
- funciona con el icono de Apple, sin tienda de apps.

**No aparece "Añadir a pantalla de inicio"?** Comprueba que:

- estás en **Safari**, no en Chrome (Chrome en iOS no lo ofrece);
- la web está en **HTTPS**;
- no estás en una ventana de navegación privada.

### Notificaciones y permisos

La app pide permisos como cualquier web. En **Ajustes → CRM Multicanal** puedes
revocar el acceso a cámara, micro o fotos.

---

## Mac y Windows

### Chrome / Edge (escritorio)

1. Abre `https://TU-DOMINIO`.
2. Haz clic en el ícono de **instalar** (⊕ o un monitor con flecha) a la
   derecha de la barra de direcciones.
3. Acepta.

Se instala como app de escritorio con ventana propia.

### macOS Safari

Menú **Archivo → Añadir al Dock…**. El ícono aparece en el Dock y funciona
como el resto de apps (⌘+Tab).

---

## Verificar que quedó bien instalada

| Comprobación | Cómo |
|---|---|
| El manifiesto es válido | `https://TU-DOMINIO/manifest.webmanifest` devuelve JSON con `icons`, `start_url` y `display: standalone` |
| Hay iconos | `https://TU-DOMINIO/icons/icon-192.png` y `icon-512.png` cargan |
| El service worker está activo | DevTools → *Application → Service Workers* (solo en escritorio) |
| Sin datos en caché | DevTools → *Application → Cache Storage*: solo deben aparecer estáticos, nunca HTML ni `/api/` |

En móvil no hay DevTools, pero si la app se instaló y abre a pantalla completa,
el manifiesto y los iconos están correctos: es lo que comprueba el navegador
antes de ofrecer la instalación.

---

## Actualizaciones

El contenido se actualiza solo. Al desplegar en Vercel, la app recoge la
versión nueva en la siguiente carga. Si una versión antigua se queda pegada,
cierra la app por completo y vuelve a abrirla (el service worker descarta las
cachés antiguas al activarse).

---

## Detalle importante: qué se guarda en el dispositivo

Este CRM **no guarda conversaciones ni respuestas en el teléfono**. El service
worker cachea únicamente estáticos (bundle de la app, iconos y manifiesto), y
nunca cachea páginas con datos de clientes ni llamadas a `/api/`.

Consecuencia práctica: **sin conexión la app no muestra datos**, solo el
"cargando". Es intencional: son datos de clientes y no deben quedar persistidos
en un dispositivo compartido. Ver el comentario al inicio de `public/sw.js`.

Si algún día quieres modo offline real, hay que añadir cifrado y una política
de expiración; no es un simple `cache.put`.
