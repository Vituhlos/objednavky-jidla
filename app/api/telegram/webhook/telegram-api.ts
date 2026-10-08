import fs from "fs";

// ─── Telegram API helpers ─────────────────────────────────────────────────────

export async function sendTyping(token: string, chatId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

export async function editMessageText(token: string, chatId: string, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", ...(replyMarkup && { reply_markup: replyMarkup }) }),
  }).catch(() => {});
}

export async function answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => {});
}

export async function editMessageReplyMarkup(token: string, chatId: string, messageId: number, replyMarkup: object): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
  }).catch(() => {});
}

export async function sendPhotoToChat(token: string, chatId: string, photoUrl: string, caption: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function answerInlineQuery(token: string, inlineQueryId: string, results: object[]): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerInlineQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // is_personal + cache_time 0: results contain the order, they must never be
    // cached or served to a different user
    body: JSON.stringify({ inline_query_id: inlineQueryId, results, cache_time: 0, is_personal: true }),
  }).catch(() => {});
}

export async function sendDocument(token: string, chatId: string, filePath: string, filename: string, caption?: string): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", new Blob([buffer], { type: "application/pdf" }), filename);
  if (caption) formData.append("caption", caption);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formData,
  }).catch(() => {});
}

export async function getBotUsername(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username: string } };
    return data.ok && data.result?.username ? data.result.username : null;
  } catch {
    return null;
  }
}
