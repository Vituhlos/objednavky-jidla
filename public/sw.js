self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {
  caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
});

self.addEventListener("push", (event) => {
  let data = { title: "Objednávky", body: "", url: "/" };
  try { data = { ...data, ...JSON.parse(event.data.text()) }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/apple-icon",
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
