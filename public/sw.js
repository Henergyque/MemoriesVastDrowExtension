/* ── Memories — Service Worker ──────────────────────────────
   Cache l'app shell pour fonctionnement PWA (ajout écran d'accueil iOS).
───────────────────────────────────────────────────────────── */

const CACHE_NAME = "memories-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
];

// Installation : mise en cache des fichiers essentiels
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch : network-first pour les requêtes API et socket.io,
// cache-first pour les assets statiques
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne pas cacher les requêtes socket.io et API
  if (
    url.pathname.startsWith("/socket.io") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // Mettre à jour le cache
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
