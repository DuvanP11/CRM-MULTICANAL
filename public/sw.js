// Service worker del CRM.
//
// IMPORTANTE (privacidad): este CRM guarda conversaciones y datos de clientes.
// Por eso el SW cachea ÚNICAMENTE estáticos sin información personal
// (bundle de Next, iconos, manifest). Nunca se cachea HTML de páginas, respuestas
// de /api/ ni nada servido a una petición con cookies: de lo contrario los datos
// de un cliente quedarían persistidos en el dispositivo y podrían verse al
// compartir el teléfono o al perder la sesión.
//
// La app sigue siendo instalable (PWA) y su "app shell" carga sin red.

const CACHE_NAME = "crm-multicanal-static-v2"; // v2 purga la v1, que cacheaba HTML
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

/** Rutas cuyo contenido es estático, inmutable y no personal. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/sw.js"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Mismo origen y solo estáticos: cache-first (los bundles de Next llevan hash).
  if (url.origin !== self.location.origin) return;
  if (!isStaticAsset(url)) return;

  // Cinturón y tirantes: aunque algo con cookies llegara aquí, no se cachea.
  if (request.headers.get("cookie")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => new Response("", { status: 504, statusText: "Offline" }));
    })
  );
});
