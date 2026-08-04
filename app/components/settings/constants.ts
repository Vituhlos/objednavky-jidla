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

export type SettingsTab = "provoz" | "lide" | "ceny" | "napojeni" | "pizza" | "system";

export const SETTINGS_TABS: { id: SettingsTab; label: string; icon: string; hint: string }[] = [
  { id: "provoz", label: "Provoz", icon: "schedule", hint: "Uzávěrka, odesílání, zavřeno" },
  { id: "lide", label: "Lidé", icon: "groups", hint: "Oddělení a uživatelé bota" },
  { id: "ceny", label: "Ceny", icon: "shopping_basket", hint: "Ceník jídel a příloh" },
  { id: "napojeni", label: "Napojení", icon: "send", hint: "E-mail, IMAP, push, Telegram" },
  { id: "pizza", label: "Pizza", icon: "local_pizza", hint: "Samostatný modul" },
  { id: "system", label: "Systém", icon: "build", hint: "Zálohy, historie, PIN" },
];
