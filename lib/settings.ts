import { getDb } from "./db";
import { createHash, timingSafeEqual } from "crypto";

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
  imapEnabled: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPass: string;
  imapSender: string;
  imapCheckTime: string;
  imapCheckDays: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  pushReminderMinutes: string;
  reminderEmailTo: string;
  autoSendFailureEmail: string;
  telegramEnabled: string;
  telegramBotToken: string;
  googleClientId: string;
  googleClientSecret: string;
  telegramWebhookSecret: string;
  telegramMorningMenuTime: string;
  telegramAppUrl: string;
  autoSendLastError: string;
  autoSendLastErrorTs: string;
  autoSendErrorAcked: string;
  pizzaCutoffEnabled: string;
  pizzaCutoffTime: string;
  pizzaCutoffDays: string;
  pizzaEnabled: string;
  /** Razítko odemčení uzávěrky, "YYYY-MM-DDTHH:mm". Viz lib/cutoff.ts. */
  orderForceOpenAt: string;
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
  imapEnabled: "imap_enabled",
  imapHost: "imap_host",
  imapPort: "imap_port",
  imapUser: "imap_user",
  imapPass: "imap_pass",
  imapSender: "imap_sender",
  imapCheckTime: "imap_check_time",
  imapCheckDays: "imap_check_days",
  vapidPublicKey: "vapid_public_key",
  vapidPrivateKey: "vapid_private_key",
  pushReminderMinutes: "push_reminder_minutes",
  reminderEmailTo: "reminder_email_to",
  autoSendFailureEmail: "auto_send_failure_email",
  telegramEnabled: "telegram_enabled",
  telegramBotToken: "telegram_bot_token",
  googleClientId: "google_client_id",
  googleClientSecret: "google_client_secret",
  telegramWebhookSecret: "telegram_webhook_secret",
  telegramMorningMenuTime: "telegram_morning_menu_time",
  telegramAppUrl: "telegram_app_url",
  autoSendLastError: "auto_send_last_error",
  autoSendLastErrorTs: "auto_send_last_error_ts",
  autoSendErrorAcked: "auto_send_error_acked",
  pizzaCutoffEnabled: "pizza_cutoff_enabled",
  pizzaCutoffTime: "pizza_cutoff_time",
  pizzaCutoffDays: "pizza_cutoff_days",
  pizzaEnabled: "pizza_enabled",
  // Klíč si drží historický název; hodnota je nově časové razítko, ne jen datum.
  orderForceOpenAt: "order_force_open_date",
};

export const SECRET_MASK = "••••••••";

const CLIENT_SECRET_FIELDS = new Set<keyof AppSettings>([
  "smtpPass",
  "imapPass",
  "vapidPrivateKey",
  "telegramBotToken",
  "googleClientSecret",
  "telegramWebhookSecret",
]);

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
    settingsPin: process.env.SETTINGS_PIN ?? "",
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
    imapEnabled: "false",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    imapUser: "",
    imapPass: "",
    imapSender: "",
    imapCheckTime: "07:00",
    imapCheckDays: "Po,Út,St,Čt,Pá",
    vapidPublicKey: "",
    vapidPrivateKey: "",
    pushReminderMinutes: "20",
    reminderEmailTo: "",
    autoSendFailureEmail: "",
    telegramEnabled: "false",
    telegramBotToken: "",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    telegramWebhookSecret: "",
    telegramMorningMenuTime: "",
    telegramAppUrl: "",
    autoSendLastError: "",
    autoSendLastErrorTs: "",
    autoSendErrorAcked: "true",
    pizzaCutoffEnabled: "false",
    pizzaCutoffTime: "10:00",
    pizzaCutoffDays: "Pá",
    pizzaEnabled: "true",
    orderForceOpenAt: "",
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
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));
  for (const [field, dbKey] of Object.entries(KEY_MAP) as [keyof AppSettings, string][]) {
    const stored = dbMap.get(dbKey);
    if (stored !== undefined) result[field] = stored;
  }
  return result;
}

export function getSettingsForClient(): AppSettings {
  const result = getSettings();
  for (const field of CLIENT_SECRET_FIELDS) {
    result[field] = result[field] ? SECRET_MASK : "";
  }
  result.settingsPin = "";
  return result;
}

export function sanitizeClientSettingsUpdates(
  updates: Partial<AppSettings>
): Partial<AppSettings> {
  const sanitized: Partial<AppSettings> = {};
  for (const [field, value] of Object.entries(updates) as [keyof AppSettings, unknown][]) {
    if (!KEY_MAP[field] || typeof value !== "string") continue;
    if (CLIENT_SECRET_FIELDS.has(field) && (!value || value === SECRET_MASK)) continue;
    if (field === "settingsPin") {
      const pin = value.trim();
      if (pin.length < 8 || pin.length > 128) {
        throw new Error("Nový PIN musí mít 8 až 128 znaků.");
      }
      sanitized[field] = pin;
      continue;
    }
    sanitized[field] = value;
  }
  return sanitized;
}

export function saveSettings(updates: Partial<AppSettings>): void {
  const db = getDb();
  db.transaction(() => {
    for (const [field, value] of Object.entries(updates) as [keyof AppSettings, string][]) {
      const dbKey = KEY_MAP[field];
      if (!dbKey || value === null || value === undefined) continue;
      const stored = field === "settingsPin" ? hashPin(value) : value;
      setSetting(dbKey, stored);
    }
  })();
}

export function checkPin(pin: string): boolean {
  const stored = getSetting("settings_pin");
  const expected = stored ?? (process.env.SETTINGS_PIN ?? "");
  if (!expected) return false;
  // Backward compat: if stored value isn't a 64-char hex hash, compare plaintext (first run)
  if (expected.length !== 64) {
    const actual = Buffer.from(pin.trim(), "utf8");
    const wanted = Buffer.from(expected.trim(), "utf8");
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  }
  const actual = Buffer.from(hashPin(pin), "hex");
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
