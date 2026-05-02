import cron from "node-cron";
import { getSettings } from "./settings";
import type { AppSettings } from "./settings";
import { getTodayOrderData, sendOrder } from "./orders";
import { getMenuItemsForDay } from "./menu";
import { sendEmail, getOrderRecipients } from "./email";
import { logAudit } from "./audit";
import { getDb } from "./db";
import { hasOrderRowContent } from "./order-utils";
import { getPragueNow } from "./time";

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

  const activeCount = data.departments.flatMap((d) => d.rows).filter(hasOrderRowContent).length;
  const minOrders = parseInt(s.autoSendMinOrders) || 1;
  if (activeCount < minOrders) {
    console.log(`[scheduler] Auto-send přeskočen — pouze ${activeCount} objednávek (min. ${minOrders}).`);
    return;
  }

  console.log(`[scheduler] Automatické odesílání objednávky ${data.order.id}...`);
  await sendOrder(data.order.id, "auto");
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

export function startScheduler(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const s = getSettings();
      const now = getPragueNow();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const jsDay = now.getDay();

      await checkAutoSend(s, currentTime, jsDay);
      await checkMenuReminder(s, currentTime, jsDay);
    } catch (err) {
      console.error("[scheduler] Chyba:", err);
    }
  });

  console.log("[scheduler] Automatický odesílač nastaven.");
}
