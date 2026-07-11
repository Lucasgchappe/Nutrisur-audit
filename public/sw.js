/* NutriSur — Service Worker
 * Estrategia:
 *  - Navegaciones (HTML): red primero, caché como respaldo → siempre la versión
 *    nueva cuando hay señal, y la app abre igual sin conexión.
 *  - Assets del mismo origen (JS/CSS/íconos, con hash en el nombre): caché
 *    primero → carga instantánea y disponible offline.
 *  - Las llamadas a Supabase NUNCA se cachean acá (los datos offline los maneja
 *    la app con localStorage y la cola de sincronización).
 */
const CACHE = "nutrisur-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase y externos: directo a la red

  // Navegación: red primero, respaldo en caché
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match(req)))
    );
    return;
  }

  // Assets: caché primero, y guardar lo que venga de la red
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
