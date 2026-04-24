const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(): void {
  listeners.forEach((fn) => fn());
}
