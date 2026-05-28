const CACHE_NAME = "kantyna-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Lightweight precache so installed PWA feels less "blank" offline.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.webmanifest",
      ]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Cleanup old caches (versioned).
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

// Basic runtime caching to improve "native" feel in installed PWA.
// - Navigations: network-first, fallback to cached "/" if offline.
// - Static assets: cache-first (scripts/styles/images/fonts).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests (App Router pages).
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match("/")) || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Static assets
  const dest = req.destination;
  const isAsset = dest === "script" || dest === "style" || dest === "image" || dest === "font";
  if (isAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Objednávky", body: "", url: "/" };
  try { data = { ...data, ...JSON.parse(event.data.text()) }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "objednavky-reminder",
      renotify: false,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
