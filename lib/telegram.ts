import { getSettings } from "./settings";

export async function sendTelegramMessage(text: string): Promise<void> {
  const s = getSettings();
  if (s.telegramEnabled !== "true" || !s.telegramBotToken || !s.telegramChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.telegramChatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[telegram] Nepodařilo se odeslat zprávu:", err);
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
    return await res.json() as { ok: boolean; description?: string };
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
