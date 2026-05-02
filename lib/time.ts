// Vrátí Date objekt jehož .get*() metody vracejí čas v Prague timezone.
// Funguje správně bez ohledu na nastavení timezone Docker containeru.
export function getPragueNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
}

// Sestaví YYYY-MM-DD z lokálních částí datumu (bez UTC konverze).
// Nahrazuje d.toISOString().slice(0,10), které vrací UTC datum a v Prague
// timezone containeru dá špatný den v okně 00:00–02:00.
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Dnešní datum v Prague timezone jako YYYY-MM-DD.
export function getPragueISODate(): string {
  return toLocalISODate(getPragueNow());
}
