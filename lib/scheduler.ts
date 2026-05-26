import cron from "node-cron";
import { getSettings, saveSettings } from "./settings";
import type { AppSettings } from "./settings";
import { checkImapForMenu } from "./imap";
import { getTodayOrderData, sendOrder } from "./orders";
import { getTodayPizzaOrderData, closePizzaOrder } from "./pizza";
import { getMenuItemsForDay, getMondayISO } from "./menu";
import { sendEmail } from "./email";
import { logAudit } from "./audit";
import { getDb } from "./db";
import { getPragueNow } from "./time";
import { broadcast } from "./sse-broadcast";
import { getAllSubscriptions, deleteSubscription } from "./push";
import { sendTelegramToSubscribers, sendTelegramToAdmins, sendTelegramReminderNotification, sendTelegramToChat, getPersonalReminderSubscribers, getPersonalMorningMenuSubscribers } from "./telegram";
import webpush from "web-push";

const DAY_CODE_TO_JS: Record<string, number> = {
  Po: 1, Út: 2, St: 3, Čt: 4, Pá: 5,
};

const JS_TO_DAY_CODE: Record<number, string> = {
  1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá",
};

function getReminderTime(cutoffTime: string): string {
  const [h, m] = cutoffTime.split(":").map(Number);
  const total = h * 60 + m - 30;
  if (total < 0) return "00:00";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function isTodayClosed(data: ReturnType<typeof getTodayOrderData>): boolean {
  if (data.departments.some((d) => d.rows.some((r) => r.mainItem?.name === "Zavřeno"))) return true;
  const { soups, meals } = data.todayMenu;
  return [...soups, ...meals].some((m) => m.name === "Zavřeno");
}

async function checkAutoSend(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (s.autoSendEnabled !== "true") return;
  if (currentTime !== s.autoSendTime) return;

  const allowedDays = s.autoSendDays
    .split(",")
    .map((d) => DAY_CODE_TO_JS[d.trim()])
    .filter((n) => n !== undefined);
  if (!allowedDays.includes(jsDay)) return;

  const data = getTodayOrderData();
  if (data.order.status === "sent") return;

  if (isTodayClosed(data)) {
    console.log("[scheduler] Auto-send přeskočen — dnes je zavřeno.");
    return;
  }

  const activeCount = data.departments.flatMap((d) => d.rows).reduce((sum, row) => {
    const main = row.mainItem ? row.mealCount : 0;
    const extra = row.extraMealItems.reduce((s, e) => s + e.count, 0);
    return sum + main + extra;
  }, 0);
  const minOrders = parseInt(s.autoSendMinOrders) || 1;
  if (activeCount < minOrders) {
    console.log(`[scheduler] Auto-send přeskočen — pouze ${activeCount} objednávek (min. ${minOrders}).`);
    return;
  }

  console.log(`[scheduler] Automatické odesílání objednávky ${data.order.id}...`);
  try {
    await sendOrder(data.order.id, "auto");
    broadcast();
    console.log("[scheduler] Objednávka automaticky odeslána.");
    // Vymaž případnou předchozí chybu a pošli Telegram potvrzení
    saveSettings({ autoSendLastError: "", autoSendErrorAcked: "true" });
    const dateStr = getPragueNow().toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
    await sendTelegramToSubscribers("notify_order_sent", `✅ <b>Objednávka odeslána</b>\n📅 ${dateStr}\n👥 ${activeCount} objednávek  ·  💰 ${data.totalPrice} Kč`);
  } catch (err) {
    console.error("[scheduler] Auto-send selhal:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    const dateStr = getPragueNow().toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
    // Ulož chybu do DB pro banner v appce
    saveSettings({ autoSendLastError: errMsg, autoSendLastErrorTs: new Date().toISOString(), autoSendErrorAcked: "false" });
    // Pošli Telegram upozornění
    await sendTelegramToAdmins(`❌ <b>Auto-send selhal</b>\n📅 ${dateStr}\n⚠️ ${errMsg}\n\nObjednávka zůstala rozepsaná — odešli ji ručně.`);
    // Fallback e-mail (pokud je nastaven)
    const recipients = (s.autoSendFailureEmail || s.reminderEmailTo)
      .split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length > 0) {
      try {
        await sendEmail({
          to: recipients,
          subject: `Selhání automatického odesílání objednávky (${dateStr})`,
          html: `<p>Dobrý den,</p>
<p>Automatické odesílání objednávky pro <strong>${dateStr}</strong> selhalo.</p>
<p><strong>Chyba:</strong> <code>${errMsg}</code></p>
<p>Objednávka zůstala ve stavu <em>rozepsaná</em>. Přihlaste se do aplikace a odešlete ji ručně.</p>`,
          text: `Automatické odesílání objednávky pro ${dateStr} selhalo.\n\nChyba: ${errMsg}\n\nObjednávka zůstala ve stavu rozepsaná. Přihlaste se do aplikace a odešlete ji ručně.`,
        });
        console.log("[scheduler] Upozornění na selhání auto-send odesláno.");
      } catch (mailErr) {
        console.error("[scheduler] Nepodařilo se odeslat upozornění na selhání:", mailErr);
      }
    }
  }
}

async function checkPizzaCutoff(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (s.pizzaEnabled === "false") return;
  if (s.pizzaCutoffEnabled !== "true") return;
  if (currentTime !== s.pizzaCutoffTime) return;

  const allowedDays = s.pizzaCutoffDays
    .split(",")
    .map((d) => DAY_CODE_TO_JS[d.trim()])
    .filter((n) => n !== undefined);
  if (!allowedDays.includes(jsDay)) return;

  const data = getTodayPizzaOrderData();
  if (data.order.status === "sent") return;

  const closed = closePizzaOrder(data.order.id);
  if (closed) {
    broadcast();
    console.log(`[scheduler] Pizza objednávka ${data.order.id} uzavřena automaticky v ${currentTime}.`);
  }
}

async function checkMenuReminder(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  const reminderTime = getReminderTime(s.cutoffTime);
  if (currentTime !== reminderTime) return;

  const dayCode = JS_TO_DAY_CODE[jsDay];
  if (!dayCode) return; // víkend

  const weekStart = getMondayISO();
  const menu = getMenuItemsForDay(dayCode);
  console.log(`[scheduler] Menu reminder check: day=${dayCode}, weekStart=${weekStart}, soups=${menu.soups.length}, meals=${menu.meals.length}`);
  if (menu.soups.length > 0 || menu.meals.length > 0) return;

  // Zkontroluj jestli upozornění nebylo dnes už odesláno
  const alreadySent = getDb()
    .prepare("SELECT id FROM audit_log WHERE action = 'menu_reminder' AND ts >= date('now', 'start of day')")
    .get();
  if (alreadySent) return;

  // Jídelníček chybí a upozornění ještě neodešlo — pokud je IMAP zapnutý, zkus import TEĎHNED
  // jako poslední šanci. Řeší případ kdy reminder vypaluje dřív než naplánovaný IMAP check
  // (např. IMAP jen ve středu v 16:00, ale upozornění vypaluje ráno v 07:30 — e-mail by odešel
  // zbytečně, přestože se e-mail s jídelníčkem teprve zpracuje).
  if (s.imapEnabled === "true") {
    console.log("[scheduler] Menu chybí — zkouším IMAP import před odesláním upozornění...");
    const imapResult = await checkImapForMenu();
    if (imapResult.found) {
      console.log(`[scheduler] Reminder zrušen — IMAP importoval jídelníček (${imapResult.weekLabel}, ${imapResult.itemCount} položek).`);
      return;
    }
    const menuAfterImap = getMenuItemsForDay(dayCode);
    if (menuAfterImap.soups.length > 0 || menuAfterImap.meals.length > 0) {
      console.log(`[scheduler] Reminder zrušen — menu nalezeno po IMAP kontrole (${menuAfterImap.meals.length} jídel).`);
      return;
    }
    console.log(`[scheduler] IMAP nic nenašel${imapResult.error ? ": " + imapResult.error : ""} — upozornění odejde.`);
  }

  const recipients = s.reminderEmailTo
    ? s.reminderEmailTo.split(",").map((e) => e.trim()).filter(Boolean)
    : [];
  if (recipients.length === 0) {
    console.warn("[scheduler] Upozornění na chybějící jídelníček NEODEŠLO — není nastaven 'E-mail pro upozornění' v Nastavení.");
    return;
  }

  // logAudit jde PŘED sendEmail — pokud DB selže, email neletí a záznam existuje pro alreadySent
  logAudit({ action: "menu_reminder", details: `Jídelníček chybí pro ${dayCode}` });

  await sendTelegramToAdmins(`⚠️ <b>Chybí jídelníček</b>\n<b>${dayCode}</b> · Uzávěrka je v <b>${s.cutoffTime}</b>\n\nPřidejte jídla v aplikaci nebo importujte PDF.`);

  await sendEmail({
    to: recipients,
    subject: "Chybí jídelníček LIMA",
    html: `<p>Dobrý den,</p>
<p>Jídelníček LIMA pro dnešní den (<strong>${dayCode}</strong>) není naplněný a uzávěrka objednávek je v <strong>${s.cutoffTime}</strong>.</p>
<p>Přejděte do aplikace a importujte PDF nebo přidejte položky ručně.</p>`,
    text: `Jídelníček LIMA pro dnešní den (${dayCode}) není naplněný. Uzávěrka je v ${s.cutoffTime}. Přejděte do aplikace a importujte jídelníček.`,
  });
  console.log(`[scheduler] Upozornění na chybějící jídelníček odesláno (${dayCode}).`);
}

async function checkPushReminder(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (!JS_TO_DAY_CODE[jsDay]) return; // víkend
  const minutes = parseInt(s.pushReminderMinutes) || 20;
  const [h, m] = s.cutoffTime.split(":").map(Number);
  const reminderTotal = h * 60 + m - minutes;
  if (reminderTotal < 0) return;
  const reminderTime = `${String(Math.floor(reminderTotal / 60)).padStart(2, "0")}:${String(reminderTotal % 60).padStart(2, "0")}`;
  if (currentTime !== reminderTime) return;

  const allSubs = getAllSubscriptions();
  if (allSubs.length === 0) return;

  const data = getTodayOrderData();
  if (data.order.status === "sent") return;
  if (isTodayClosed(data)) return;

  // Zjisti které endpointy mají v dnešní objednávce neprázdný řádek
  const activeEndpoints = new Set(
    data.departments
      .flatMap((d) => d.rows)
      .filter((r) => r.mainItem || r.soupItem || r.extraMealItems.length > 0)
      .map((r) => (r as unknown as { pushEndpoint?: string }).pushEndpoint)
      .filter(Boolean) as string[]
  );

  // Pošli jen těm, kdo ještě neobjednali
  const pending = allSubs.filter((sub) => !activeEndpoints.has(sub.endpoint));
  if (pending.length === 0) {
    console.log("[scheduler] Push přeskočen — všichni už objednali.");
    return;
  }

  console.log(`[scheduler] Odesílám push upozornění ${pending.length} prohlížečům...`);
  const { publicKey, privateKey } = { publicKey: s.vapidPublicKey, privateKey: s.vapidPrivateKey };
  if (!publicKey || !privateKey) { console.warn("[scheduler] VAPID klíče nejsou nastaveny, push přeskočen."); return; }

  webpush.setVapidDetails("mailto:app@localhost", publicKey, privateKey);
  const payload = JSON.stringify({ title: "Nezapomeň objednat! 🍽️", body: `Uzávěrka je v ${s.cutoffTime} — zbývá ${minutes} minut.`, url: "/" });

  await Promise.allSettled(
    pending.map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) deleteSubscription(row.endpoint);
        else console.warn("[push] Chyba:", (err as Error).message);
      }
    })
  );
}

async function checkImapImport(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (s.imapEnabled !== "true") return;
  if (currentTime !== s.imapCheckTime) return;
  const allowedDays = s.imapCheckDays
    .split(",")
    .map((d) => DAY_CODE_TO_JS[d.trim()])
    .filter((n) => n !== undefined);
  if (!allowedDays.includes(jsDay)) return;

  console.log("[scheduler] Kontrola IMAP pro jídelníček...");
  const result = await checkImapForMenu();
  if (result.found) {
    console.log(`[scheduler] IMAP: importován jídelníček ${result.weekLabel} (${result.itemCount} položek).`);
    await sendTelegramToSubscribers("notify_menu_imported", `📋 <b>Jídelníček importován</b>\n${result.weekLabel} · ${result.itemCount} položek`);
  } else if (result.error) {
    console.warn(`[scheduler] IMAP: ${result.error}`);
  } else {
    console.log("[scheduler] IMAP: žádný nový mail s jídelníčkem.");
  }
}

async function checkMorningMenu(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (!s.telegramMorningMenuTime || currentTime !== s.telegramMorningMenuTime) return;
  if (!JS_TO_DAY_CODE[jsDay]) return;

  const dayCode = JS_TO_DAY_CODE[jsDay];
  const now = getPragueNow();
  const dateStr = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  const menu = getMenuItemsForDay(dayCode);

  let text: string;
  if (menu.soups.length === 0 && menu.meals.length === 0) {
    text = `🍽 <b>Jídelníček ${dateStr}</b>\n\nJídelníček zatím není k dispozici.`;
  } else {
    const lines = [`🍽 <b>Jídelníček ${dateStr}</b>`, ""];
    if (menu.soups.length > 0) {
      lines.push("<b>Polévky</b>");
      menu.soups.forEach((item) => lines.push(`  • ${item.name}`));
      lines.push("");
    }
    if (menu.meals.length > 0) {
      lines.push("<b>Jídla</b>");
      menu.meals.forEach((item) => lines.push(`  • ${item.name}`));
    }

    text = lines.join("\n");
  }

  text += `\n\n⏰ Uzávěrka je v <b>${s.cutoffTime}</b>`;

  await sendTelegramToSubscribers("notify_morning_menu", text);
}

async function checkTelegramReminder(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  if (!JS_TO_DAY_CODE[jsDay]) return;
  const minutes = parseInt(s.pushReminderMinutes) || 20;
  const [h, m] = s.cutoffTime.split(":").map(Number);
  const reminderTotal = h * 60 + m - minutes;
  if (reminderTotal < 0) return;
  const reminderTime = `${String(Math.floor(reminderTotal / 60)).padStart(2, "0")}:${String(reminderTotal % 60).padStart(2, "0")}`;
  if (currentTime !== reminderTime) return;

  const data = getTodayOrderData();
  if (data.order.status === "sent") return;
  if (isTodayClosed(data)) return;

  const db = getDb();
  const now = getPragueNow();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentPeople = db.prepare(`
    SELECT DISTINCT r.person_name FROM order_rows r
    JOIN orders o ON o.id = r.order_id
    WHERE r.person_name != '' AND o.date >= ? AND o.id != ? AND o.status = 'sent'
  `).all(twoWeeksAgo.toISOString().slice(0, 10), data.order.id) as { person_name: string }[];
  const orderedToday = new Set(
    data.departments.flatMap((d) => d.rows.filter((r) => r.personName).map((r) => r.personName))
  );
  const missingCount = recentPeople.filter((r) => !orderedToday.has(r.person_name)).length;
  const missingLine = missingCount > 0
    ? `\n👥 Ještě neobjednali: <b>${missingCount} ${missingCount === 1 ? "osoba" : missingCount < 5 ? "osoby" : "osob"}</b>`
    : "";

  await sendTelegramReminderNotification(
    `⏰ <b>Uzávěrka v ${s.cutoffTime}</b> — zbývá ${minutes} minut${missingLine}`,
  );
}

async function checkPersonalMorningMenu(currentTime: string, jsDay: number): Promise<void> {
  if (!JS_TO_DAY_CODE[jsDay]) return;
  const subs = getPersonalMorningMenuSubscribers(currentTime);
  if (subs.length === 0) return;

  const s = getSettings();
  const dayCode = JS_TO_DAY_CODE[jsDay];
  const now = getPragueNow();
  const dateStr = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
  const menu = getMenuItemsForDay(dayCode);

  const lines = [`🍽 <b>Jídelníček ${dateStr}</b>`, ""];
  if (menu.soups.length === 0 && menu.meals.length === 0) {
    lines.push("Jídelníček zatím není k dispozici.");
  } else {
    if (menu.soups.length > 0) {
      lines.push("<b>Polévky</b>");
      menu.soups.forEach((item) => lines.push(`  • ${item.name}`));
      lines.push("");
    }
    if (menu.meals.length > 0) {
      lines.push("<b>Jídla</b>");
      menu.meals.forEach((item) => lines.push(`  • ${item.name}`));
    }
  }
  lines.push("", `⏰ Uzávěrka je v <b>${s.cutoffTime}</b>`);
  const text = lines.join("\n");

  for (const sub of subs) {
    await sendTelegramToChat(sub.chatId, text);
  }
}

async function checkPersonalReminders(currentTime: string, jsDay: number): Promise<void> {
  if (!JS_TO_DAY_CODE[jsDay]) return;
  const subs = getPersonalReminderSubscribers(currentTime);
  if (subs.length === 0) return;
  const data = getTodayOrderData();
  if (data.order.status === "sent" || isTodayClosed(data)) return;
  const s = getSettings();
  const [h, m] = s.cutoffTime.split(":").map(Number);
  const cutoffTotal = h * 60 + m;
  const [ch, cm] = currentTime.split(":").map(Number);
  const remaining = cutoffTotal - (ch * 60 + cm);
  const remainingText = remaining > 0 ? ` — zbývá ${remaining} minut` : "";
  for (const sub of subs) {
    await sendTelegramToChat(
      sub.chatId,
      `⏰ <b>Připomenutí objednávky</b>\nUzávěrka v <b>${s.cutoffTime}</b>${remainingText}`,
    );
  }
}

export function startScheduler(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const s = getSettings();
      const now = getPragueNow();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const jsDay = now.getDay();

      await checkAutoSend(s, currentTime, jsDay);
      await checkPizzaCutoff(s, currentTime, jsDay);
      await checkImapImport(s, currentTime, jsDay);
      await checkMenuReminder(s, currentTime, jsDay);
      await checkPushReminder(s, currentTime, jsDay);
      await checkMorningMenu(s, currentTime, jsDay);
      await checkTelegramReminder(s, currentTime, jsDay);
      await checkPersonalReminders(currentTime, jsDay);
      await checkPersonalMorningMenu(currentTime, jsDay);
    } catch (err) {
      console.error("[scheduler] Chyba:", err);
    }
  });

  console.log("[scheduler] Automatický odesílač nastaven.");
}
