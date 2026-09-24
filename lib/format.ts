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

/** Tvar podstatného jména podle počtu: 1 položka · 3 položky · 5 položek (0 jako 5). */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}

/** „3 položky“ — číslo i správný tvar slova. */
export function countWord(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`;
}

/** „zbývá 1 minuta“ · „zbývají 3 minuty“ · „zbývá 5 minut“ — sloveso se shoduje s číslem. */
export function remainingMinutes(count: number): string {
  if (count >= 2 && count <= 4) return `zbývají ${count} minuty`;
  return `zbývá ${countWord(count, "minuta", "minuty", "minut")}`;
}
