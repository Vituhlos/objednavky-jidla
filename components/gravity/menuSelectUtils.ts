import type { MenuItem } from "@/lib/types";

export function menuItemsToSelectOptions(items: MenuItem[]) {
  return items.map((o) => ({
    value: String(o.id),
    content: o.code ? `${o.code} – ${o.name}` : o.name,
  }));
}

export function idToSelectValue(id: number | null): string[] {
  return id != null ? [String(id)] : [];
}

export function selectValueToId(value: string[]): number | null {
  const v = value[0];
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
