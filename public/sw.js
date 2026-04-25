const STATIC_CACHE = "static-v1";
const PAGE_CACHE = "pages-v1";

const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  const keep = [STATIC_CACHE, PAGE_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // API + SSE — vždy ze sítě, nikdy z cache
  if (url.pathname.startsWith("/api/")) return;

  // Statické assety (JS/CSS s hashem, fonty) — cache-first
  if (STATIC_PATTERNS.some((p) => p.test(url.href))) {
    e.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // HTML stránky — network-first, cache jako záloha při výpadku
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
