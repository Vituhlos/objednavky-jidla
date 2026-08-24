export function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function pluralizeOrders(count: number): string {
  if (count === 1) return "objednávka";
  if (count >= 2 && count <= 4) return "objednávky";
  return "objednávek";
}

/** „1 příloha · 3 přílohy · 6 příloh" — souhrn příloh v hlavičce editace. */
export function pluralizeExtras(count: number): string {
  if (count === 1) return "příloha";
  if (count >= 2 && count <= 4) return "přílohy";
  return "příloh";
}
