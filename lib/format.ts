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

/**
 * Datum z databáze (`YYYY-MM-DD`) v české podobě.
 *
 * Poledne, ne půlnoc: v zimním čase by `T00:00` po převodu na místní čas
 * spadlo na předchozí den.
 */
export function formatCzechDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

/**
 * Časové razítko z databáze v české podobě.
 *
 * Auth vrstva ukládá hotové ISO-8601 v UTC (`2026-08-26T08:31:59.761Z`),
 * starší tabulky `YYYY-MM-DD HH:MM:SS` bez zóny. Druhý tvar je taky UTC, jen
 * to o sobě neříká — bez doplnění by se zobrazil posunutý o dvě hodiny.
 */
export function formatCzechDateTime(value: string): string {
  const normalized = /[TZ]/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
