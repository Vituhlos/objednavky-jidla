import { getDb } from "./db";
import { getSettings } from "./settings";

export interface TelegramSubscription {
  id: number;
  chatId: string;
  firstName: string;
  username: string;
  isAdmin: boolean;
  notifyReminder: boolean;
  registeredAt: string;
}

type DbRow = {
  id: number; chat_id: string; first_name: string; username: string;
  is_admin: number; notify_reminder: number; registered_at: string;
};

export function getTelegramSubscriptions(): TelegramSubscription[] {
  const rows = getDb()
    .prepare("SELECT * FROM telegram_subscriptions ORDER BY registered_at")
    .all() as DbRow[];
  return rows.map((r) => ({
    id: r.id,
    chatId: r.chat_id,
    firstName: r.first_name,
    username: r.username,
    isAdmin: r.is_admin === 1,
    notifyReminder: r.notify_reminder === 1,
    registeredAt: r.registered_at,
  }));
}

export function registerTelegramUser(
  chatId: string,
  firstName: string,
  username: string,
): { isNew: boolean; isAdmin: boolean } {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, is_admin FROM telegram_subscriptions WHERE chat_id = ?")
    .get(chatId) as { id: number; is_admin: number } | undefined;
  if (existing) return { isNew: false, isAdmin: existing.is_admin === 1 };

  const { cnt } = db
    .prepare("SELECT COUNT(*) as cnt FROM telegram_subscriptions")
    .get() as { cnt: number };
  const isAdmin = cnt === 0;

  db.prepare(
    "INSERT INTO telegram_subscriptions (chat_id, first_name, username, is_admin) VALUES (?, ?, ?, ?)",
  ).run(chatId, firstName, username, isAdmin ? 1 : 0);

  return { isNew: true, isAdmin };
}

export function isTelegramAdmin(chatId: string): boolean {
  const row = getDb()
    .prepare("SELECT is_admin FROM telegram_subscriptions WHERE chat_id = ?")
    .get(chatId) as { is_admin: number } | undefined;
  return row?.is_admin === 1;
}

export function isTelegramRegistered(chatId: string): boolean {
  return !!getDb()
    .prepare("SELECT id FROM telegram_subscriptions WHERE chat_id = ?")
    .get(chatId);
}

export function removeTelegramSubscription(chatId: string): void {
  getDb().prepare("DELETE FROM telegram_subscriptions WHERE chat_id = ?").run(chatId);
}

export function setTelegramAdmin(chatId: string, isAdmin: boolean): void {
  getDb()
    .prepare("UPDATE telegram_subscriptions SET is_admin = ? WHERE chat_id = ?")
    .run(isAdmin ? 1 : 0, chatId);
}

export function toggleTelegramReminder(chatId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT notify_reminder FROM telegram_subscriptions WHERE chat_id = ?")
    .get(chatId) as { notify_reminder: number } | undefined;
  const newVal = row?.notify_reminder === 1 ? 0 : 1;
  db.prepare("UPDATE telegram_subscriptions SET notify_reminder = ? WHERE chat_id = ?").run(newVal, chatId);
  return newVal === 1;
}

export function getSubscribersWithReminder(): TelegramSubscription[] {
  return getTelegramSubscriptions().filter((s) => s.notifyReminder);
}

async function sendToChat(token: string, chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken) return;
  const subs = getTelegramSubscriptions();
  if (subs.length === 0) return;
  await Promise.allSettled(
    subs.map((sub) =>
      sendToChat(s.telegramBotToken, sub.chatId, text).catch((err) =>
        console.error(`[telegram] Chyba při odesílání na ${sub.chatId}:`, err),
      ),
    ),
  );
}

export async function sendTelegramToAdmins(text: string): Promise<void> {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken) return;
  const admins = getTelegramSubscriptions().filter((s) => s.isAdmin);
  if (admins.length === 0) return;
  await Promise.allSettled(
    admins.map((sub) =>
      sendToChat(s.telegramBotToken, sub.chatId, text).catch((err) =>
        console.error(`[telegram] Chyba při odesílání adminovi ${sub.chatId}:`, err),
      ),
    ),
  );
}

export async function sendTelegramReminderNotification(text: string): Promise<void> {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken) return;
  const subs = getSubscribersWithReminder();
  if (subs.length === 0) return;
  await Promise.allSettled(
    subs.map((sub) =>
      sendToChat(s.telegramBotToken, sub.chatId, text).catch((err) =>
        console.error(`[telegram] Chyba při odesílání reminder na ${sub.chatId}:`, err),
      ),
    ),
  );
}

export async function sendTelegramToChat(chatId: string, text: string): Promise<void> {
  const s = getSettings();
  if (!s.telegramBotToken) return;
  try {
    await sendToChat(s.telegramBotToken, chatId, text);
  } catch (err) {
    console.error("[telegram] Chyba při odesílání:", err);
  }
}

export async function getTelegramBotInfo(): Promise<{
  ok: boolean;
  firstName?: string;
  username?: string;
  error?: string;
}> {
  const s = getSettings();
  if (!s.telegramBotToken) return { ok: false, error: "Token není nastaven." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { first_name: string; username: string };
      description?: string;
    };
    if (data.ok && data.result)
      return { ok: true, firstName: data.result.first_name, username: data.result.username };
    return { ok: false, error: data.description };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function getTelegramWebhookStatus(): Promise<{
  ok: boolean;
  hasWebhook: boolean;
  url?: string;
}> {
  const s = getSettings();
  if (!s.telegramBotToken) return { ok: false, hasWebhook: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/getWebhookInfo`);
    const data = (await res.json()) as { ok: boolean; result?: { url: string } };
    if (!data.ok) return { ok: false, hasWebhook: false };
    return { ok: true, hasWebhook: !!(data.result?.url), url: data.result?.url };
  } catch {
    return { ok: false, hasWebhook: false };
  }
}

export async function setTelegramWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const s = getSettings();
  if (!s.telegramBotToken) return { ok: false, description: "Bot token není nastaven." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    return (await res.json()) as { ok: boolean; description?: string };
  } catch (err) {
    return { ok: false, description: String(err) };
  }
}

export async function deleteTelegramWebhook(): Promise<void> {
  const s = getSettings();
  if (!s.telegramBotToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/deleteWebhook`, { method: "POST" });
  } catch { /* ignore */ }
}
