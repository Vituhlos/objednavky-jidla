// Konstanty obrazovky Nastavení.
//
// Podmnožina souboru z větve feat/heroui-migration — hodnoty jsou ověřeně
// shodné. Chybí ACTION_TONES a AUDIT_FIELD_LABELS (zdejší audit log je
// nepoužívá) a SETTINGS_TABS, které tam nesou dlouhé popisy místo krátkých
// nápověd, takže by změnily texty v navigaci.

export const ACCENT_OPTIONS = [
  { value: "blue", label: "Modrá" },
  { value: "rust", label: "Rezavá" },
  { value: "green", label: "Zelená" },
  { value: "amber", label: "Jantarová" },
  { value: "navy", label: "Námořnická" },
  { value: "orange", label: "Oranžová" },
  { value: "red", label: "Červená" },
] as const;

export const ACCENT_COLORS: Record<string, string> = {
  blue: "#3B82F6",
  rust: "#C2654D",
  green: "#4F8A53",
  amber: "#F59E0B",
  navy: "#1e40af",
  orange: "#EA580C",
  red: "#dc2626",
};

export const DAY_OPTIONS = [
  { code: "Po", label: "Po" },
  { code: "Út", label: "Út" },
  { code: "St", label: "St" },
  { code: "Čt", label: "Čt" },
  { code: "Pá", label: "Pá" },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  row_add: "Přidání řádku",
  row_update: "Úprava řádku",
  row_delete: "Smazání řádku",
  order_send: "Odeslání objednávky",
  order_reopen: "Znovuotevření",
  order_clear: "Vymazání objednávky",
  auto_send: "Auto-odeslání",
  menu_reminder: "Upozornění na chybějící menu",
  person_rename: "Přejmenování strávníka",
  person_merge: "Sloučení strávníků",
  person_activate: "Aktivace strávníka",
  person_deactivate: "Deaktivace strávníka",
  person_delete: "Smazání strávníka",
};

export const CHANNEL_LABELS: Record<string, string> = {
  stable: "Stabilní",
  beta: "Beta",
  dev: "Vývoj",
};

export const RELEASE_SECTION_LABELS: Record<string, string> = {
  Added: "Přidáno",
  Changed: "Změněno",
  Deprecated: "Zastaralé",
  Removed: "Odstraněno",
  Fixed: "Opraveno",
  Security: "Bezpečnost",
  "Migration notes": "Migrační poznámky",
  "Known issues": "Známá omezení",
};

// Categories follow what the operator is trying to do, not which technology the
// setting talks to — push notifications used to live under "E-mail & IMAP" and the
// pizza module under "Objednávka".
export type SettingsTab = "provoz" | "lide" | "ceny" | "napojeni" | "pizza" | "system";

export const SETTINGS_TABS: { id: SettingsTab; label: string; icon: string; hint: string }[] = [
  { id: "provoz",   label: "Provoz",   icon: "schedule",         hint: "Uzávěrka, odesílání, zavřeno" },
  { id: "lide",     label: "Lidé",     icon: "groups",           hint: "Oddělení a uživatelé bota" },
  { id: "ceny",     label: "Ceny",     icon: "shopping_basket",  hint: "Ceník jídel a příloh" },
  { id: "napojeni", label: "Napojení", icon: "send",             hint: "E-mail, IMAP, push, Telegram" },
  { id: "pizza",    label: "Pizza",    icon: "local_pizza",      hint: "Samostatný modul" },
  { id: "system",   label: "Systém",   icon: "build",            hint: "Zálohy, historie, PIN" },
];
