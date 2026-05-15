import { getGlobalDb } from "./global-db";

export interface GlobalSettings {
  // Menu prices (set by kitchen)
  defaultSoupPrice: string;
  defaultMealPrice: string;
  priceRoll: string;
  priceBreadDumpling: string;
  pricePotatoDumpling: string;
  priceKetchup: string;
  priceTatarka: string;
  priceBbq: string;
  // Global deadline (one for all tenants)
  cutoffTime: string;
  autoSendEnabled: string;
  autoSendTime: string;
  autoSendDays: string;
  autoSendMinOrders: string;
  autoSendLastError: string;
  autoSendLastErrorTs: string;
  autoSendErrorAcked: string;
  autoSendFailureEmail: string;
  // Kitchen email (outgoing)
  orderEmailTo: string;
  reminderEmailTo: string;
  // IMAP (kitchen receives PDF menus)
  imapEnabled: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPass: string;
  imapSender: string;
  imapCheckTime: string;
  imapCheckDays: string;
  // Telegram (global bot)
  telegramEnabled: string;
  telegramBotToken: string;
  telegramMorningMenuTime: string;
  telegramAppUrl: string;
  // Push notifications
  vapidPublicKey: string;
  vapidPrivateKey: string;
  pushReminderMinutes: string;
}

const GLOBAL_KEY_MAP: Record<keyof GlobalSettings, string> = {
  defaultSoupPrice:     "default_soup_price",
  defaultMealPrice:     "default_meal_price",
  priceRoll:            "price_roll",
  priceBreadDumpling:   "price_bread_dumpling",
  pricePotatoDumpling:  "price_potato_dumpling",
  priceKetchup:         "price_ketchup",
  priceTatarka:         "price_tatarka",
  priceBbq:             "price_bbq",
  cutoffTime:           "cutoff_time",
  autoSendEnabled:      "auto_send_enabled",
  autoSendTime:         "auto_send_time",
  autoSendDays:         "auto_send_days",
  autoSendMinOrders:    "auto_send_min_orders",
  autoSendLastError:    "auto_send_last_error",
  autoSendLastErrorTs:  "auto_send_last_error_ts",
  autoSendErrorAcked:   "auto_send_error_acked",
  autoSendFailureEmail: "auto_send_failure_email",
  orderEmailTo:         "order_email_to",
  reminderEmailTo:      "reminder_email_to",
  imapEnabled:          "imap_enabled",
  imapHost:             "imap_host",
  imapPort:             "imap_port",
  imapUser:             "imap_user",
  imapPass:             "imap_pass",
  imapSender:           "imap_sender",
  imapCheckTime:        "imap_check_time",
  imapCheckDays:        "imap_check_days",
  telegramEnabled:      "telegram_enabled",
  telegramBotToken:     "telegram_bot_token",
  telegramMorningMenuTime: "telegram_morning_menu_time",
  telegramAppUrl:       "telegram_app_url",
  vapidPublicKey:       "vapid_public_key",
  vapidPrivateKey:      "vapid_private_key",
  pushReminderMinutes:  "push_reminder_minutes",
};

function globalDefaults(): GlobalSettings {
  return {
    defaultSoupPrice:     "30",
    defaultMealPrice:     "110",
    priceRoll:            "5",
    priceBreadDumpling:   "40",
    pricePotatoDumpling:  "45",
    priceKetchup:         "20",
    priceTatarka:         "20",
    priceBbq:             "20",
    cutoffTime:           "08:00",
    autoSendEnabled:      "false",
    autoSendTime:         "08:00",
    autoSendDays:         "Po,Út,St,Čt,Pá",
    autoSendMinOrders:    "1",
    autoSendLastError:    "",
    autoSendLastErrorTs:  "",
    autoSendErrorAcked:   "true",
    autoSendFailureEmail: "",
    orderEmailTo:         process.env.ORDER_EMAIL_TO ?? process.env.ORDER_EMAIL_DEFAULT ?? "",
    reminderEmailTo:      "",
    imapEnabled:          "false",
    imapHost:             "imap.gmail.com",
    imapPort:             "993",
    imapUser:             "",
    imapPass:             "",
    imapSender:           "",
    imapCheckTime:        "07:00",
    imapCheckDays:        "Po,Út,St,Čt,Pá",
    telegramEnabled:      "false",
    telegramBotToken:     "",
    telegramMorningMenuTime: "",
    telegramAppUrl:       "",
    vapidPublicKey:       "",
    vapidPrivateKey:      "",
    pushReminderMinutes:  "20",
  };
}

export function getGlobalSettings(): GlobalSettings {
  const defaults = globalDefaults();
  const result = { ...defaults };
  const rows = getGlobalDb()
    .prepare("SELECT key, value FROM settings")
    .all() as { key: string; value: string }[];
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));
  for (const [field, dbKey] of Object.entries(GLOBAL_KEY_MAP) as [keyof GlobalSettings, string][]) {
    const stored = dbMap.get(dbKey);
    if (stored !== undefined) result[field] = stored;
  }
  return result;
}

export function saveGlobalSettings(updates: Partial<GlobalSettings>): void {
  const db = getGlobalDb();
  db.transaction(() => {
    for (const [field, value] of Object.entries(updates) as [keyof GlobalSettings, string][]) {
      const dbKey = GLOBAL_KEY_MAP[field];
      if (!dbKey || value === null || value === undefined) continue;
      db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(dbKey, value);
    }
  })();
}

export function getGlobalSetting(key: string): string | null {
  const row = getGlobalDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setGlobalSetting(key: string, value: string): void {
  getGlobalDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
