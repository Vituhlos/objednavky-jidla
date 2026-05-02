// Pasivní SW — žádný fetch handler = nulový overhead na síťové requesty.
// Aktivuje se okamžitě (skipWaiting), smaže staré cache bez blokování (fire-and-forget).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {
  // Bez e.waitUntil — activate se dokončí ihned, iOS Safari nečeká
  caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
});
// Žádný fetch handler = prohlížeč zpracovává requesty sám
