self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {
  // Push-only SW: do not aggressively clear caches.
  // If you later add a fetch handler + caching strategy, introduce versioned cache names here.
  self.clients.claim();
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
