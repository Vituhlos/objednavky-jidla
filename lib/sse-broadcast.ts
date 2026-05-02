// Listeners uloženy na global aby byly sdílené přes všechny
// Next.js module instances v jednom Node.js procesu.
// Module-level Set nefunguje spolehlivě – Next.js může načíst
// tento modul zvlášť pro Server Actions a zvlášť pro API routes.
const g = globalThis as typeof globalThis & {
  _sseListeners?: Set<() => void>;
};
if (!g._sseListeners) g._sseListeners = new Set();

export function subscribe(fn: () => void): () => void {
  g._sseListeners!.add(fn);
  return () => g._sseListeners!.delete(fn);
}

export function broadcast(): void {
  g._sseListeners!.forEach((fn) => {
    try { fn(); } catch { /* spojení bylo zavřeno */ }
  });
}
