import cron from "node-cron";
import { getSettings } from "./settings";
import type { AppSettings } from "./settings";
import { checkImapForMenu } from "./imap";
import { getTodayOrderData, sendOrder } from "./orders";
import { getMenuItemsForDay } from "./menu";
import { sendEmail, getOrderRecipients } from "./email";
import { logAudit } from "./audit";
import { getDb } from "./db";
import { getPragueNow } from "./time";
import { broadcast } from "./sse-broadcast";
import { sendPushToAll, getAllSubscriptions, deleteSubscription } from "./push";
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
  await sendOrder(data.order.id, "auto");
  broadcast();
  console.log("[scheduler] Objednávka automaticky odeslána.");
}

async function checkMenuReminder(s: AppSettings, currentTime: string, jsDay: number): Promise<void> {
  const reminderTime = getReminderTime(s.cutoffTime);
  if (currentTime !== reminderTime) return;

  const dayCode = JS_TO_DAY_CODE[jsDay];
  if (!dayCode) return; // víkend

  const menu = getMenuItemsForDay(dayCode);
  if (menu.soups.length > 0 || menu.meals.length > 0) return; // jídelníček je v pořádku

  // Zkontroluj jestli upozornění nebylo dnes už odesláno
  const alreadySent = getDb()
    .prepare("SELECT id FROM audit_log WHERE action = 'menu_reminder' AND ts >= date('now', 'start of day')")
    .get();
  if (alreadySent) return;

  const recipients = getOrderRecipients();
  await sendEmail({
    to: recipients,
    subject: "Chybí jídelníček LIMA",
    html: `<p>Dobrý den,</p>
<p>Jídelníček LIMA pro dnešní den (<strong>${dayCode}</strong>) není naplněný a uzávěrka objednávek je v <strong>${s.cutoffTime}</strong>.</p>
<p>Přejděte do aplikace a importujte PDF nebo přidejte položky ručně.</p>`,
    text: `Jídelníček LIMA pro dnešní den (${dayCode}) není naplněný. Uzávěrka je v ${s.cutoffTime}. Přejděte do aplikace a importujte jídelníček.`,
  });

  logAudit({ action: "menu_reminder", details: `Jídelníček chybí pro ${dayCode}` });
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
  } else if (result.error) {
    console.warn(`[scheduler] IMAP: ${result.error}`);
  } else {
    console.log("[scheduler] IMAP: žádný nový mail s jídelníčkem.");
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
      await checkImapImport(s, currentTime, jsDay);
      await checkMenuReminder(s, currentTime, jsDay);
      await checkPushReminder(s, currentTime, jsDay);
    } catch (err) {
      console.error("[scheduler] Chyba:", err);
    }
  });

  console.log("[scheduler] Automatický odesílač nastaven.");
}
