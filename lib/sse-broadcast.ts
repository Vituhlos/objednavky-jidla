// Listeners stored on globalThis so they're shared across all
// Next.js module instances in one Node.js process.
const g = globalThis as typeof globalThis & {
  _sseListeners?: Set<() => void>;
  _sseTenantListeners?: Map<string, Set<() => void>>;
};
if (!g._sseListeners) g._sseListeners = new Set();

export function subscribe(fn: () => void): () => void {
  g._sseListeners!.add(fn);
  return () => g._sseListeners!.delete(fn);
}

export function broadcast(): void {
  g._sseListeners!.forEach((fn) => {
    try { fn(); } catch { /* connection closed */ }
  });
}

export function subscribeTenant(slug: string, fn: () => void): () => void {
  if (!g._sseTenantListeners) g._sseTenantListeners = new Map();
  if (!g._sseTenantListeners.has(slug)) g._sseTenantListeners.set(slug, new Set());
  g._sseTenantListeners.get(slug)!.add(fn);
  return () => g._sseTenantListeners!.get(slug)?.delete(fn);
}

export function broadcastForTenant(slug: string): void {
  g._sseTenantListeners?.get(slug)?.forEach((fn) => {
    try { fn(); } catch { /* connection closed */ }
  });
}
