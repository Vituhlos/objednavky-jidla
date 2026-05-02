import { getDb } from "./db";
import { createHash } from "crypto";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

export interface AppSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpReplyTo: string;
  smtpSecure: string;
  orderEmailTo: string;
  orderExtraEmail: string;
  cutoffTime: string;
  settingsPin: string;
  defaultSoupPrice: string;
  defaultMealPrice: string;
  priceRoll: string;
  priceBreadDumpling: string;
  pricePotatoDumpling: string;
  priceKetchup: string;
  priceTatarka: string;
  priceBbq: string;
  autoSendEnabled: string;
  autoSendTime: string;
  autoSendDays: string;
  autoSendMinOrders: string;
}

const KEY_MAP: Record<keyof AppSettings, string> = {
  smtpHost: "smtp_host",
  smtpPort: "smtp_port",
  smtpUser: "smtp_user",
  smtpPass: "smtp_pass",
  smtpFrom: "smtp_from",
  smtpReplyTo: "smtp_reply_to",
  smtpSecure: "smtp_secure",
  orderEmailTo: "order_email_to",
  orderExtraEmail: "order_extra_email",
  cutoffTime: "cutoff_time",
  settingsPin: "settings_pin",
  defaultSoupPrice: "default_soup_price",
  defaultMealPrice: "default_meal_price",
  priceRoll: "price_roll",
  priceBreadDumpling: "price_bread_dumpling",
  pricePotatoDumpling: "price_potato_dumpling",
  priceKetchup: "price_ketchup",
  priceTatarka: "price_tatarka",
  priceBbq: "price_bbq",
  autoSendEnabled: "auto_send_enabled",
  autoSendTime: "auto_send_time",
  autoSendDays: "auto_send_days",
  autoSendMinOrders: "auto_send_min_orders",
};

function envDefaults(): AppSettings {
  return {
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: process.env.SMTP_PORT ?? "587",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFrom: process.env.SMTP_FROM ?? "",
    smtpReplyTo: process.env.SMTP_REPLY_TO ?? "",
    smtpSecure: process.env.SMTP_SECURE ?? "false",
    orderEmailTo:
      process.env.ORDER_EMAIL_TO ?? process.env.ORDER_EMAIL_DEFAULT ?? "jirirytir1992@gmail.com",
    orderExtraEmail: process.env.ORDER_EXTRA_EMAIL ?? "",
    cutoffTime: "08:00",
    settingsPin: process.env.SETTINGS_PIN ?? "1234",
    defaultSoupPrice: "30",
    defaultMealPrice: "110",
    priceRoll: "5",
    priceBreadDumpling: "40",
    pricePotatoDumpling: "45",
    priceKetchup: "20",
    priceTatarka: "20",
    priceBbq: "20",
    autoSendEnabled: "false",
    autoSendTime: "08:00",
    autoSendDays: "Po,Út,St,Čt,Pá",
    autoSendMinOrders: "1",
  };
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function getSettings(): AppSettings {
  const defaults = envDefaults();
  const result = { ...defaults };
  for (const [field, dbKey] of Object.entries(KEY_MAP) as [keyof AppSettings, string][]) {
    const stored = getSetting(dbKey);
    if (stored !== null) {
      result[field] = stored;
    }
  }
  return result;
}

export function saveSettings(updates: Partial<AppSettings>): void {
  const db = getDb();
  db.transaction(() => {
    for (const [field, value] of Object.entries(updates) as [keyof AppSettings, string][]) {
      const dbKey = KEY_MAP[field];
      if (!dbKey) continue;
      // Hash the PIN before storing
      const stored = field === "settingsPin" ? hashPin(value) : value;
      setSetting(dbKey, stored);
    }
  })();
}

export function checkPin(pin: string): boolean {
  const stored = getSetting("settings_pin");
  const expected = stored ?? (process.env.SETTINGS_PIN ?? "1234");
  // Backward compat: if stored value isn't a 64-char hex hash, compare plaintext (first run)
  if (expected.length !== 64) {
    return pin.trim() === expected.trim();
  }
  return hashPin(pin) === expected;
}
