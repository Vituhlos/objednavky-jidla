import cron from "node-cron";
import { getSettings } from "./settings";
import { getTodayOrderData, sendOrder } from "./orders";
import { logAudit } from "./audit";
import { hasOrderRowContent } from "./order-utils";

const DAY_CODE_TO_JS: Record<string, number> = {
  Po: 1, Út: 2, St: 3, Čt: 4, Pá: 5,
};

function isTodayClosed(data: ReturnType<typeof getTodayOrderData>): boolean {
  return data.departments.some((d) =>
    d.rows.some((r) => r.mainItem?.name === "Zavřeno")
  ) || (() => {
    // also check menu directly — day might have no rows but "Zavřeno" in menu
    const { soups, meals } = data.todayMenu;
    return [...soups, ...meals].some((m) => m.name === "Zavřeno");
  })();
}

export function startScheduler(): void {
  // Runs every minute, checks if auto-send conditions are met
  cron.schedule("* * * * *", async () => {
    try {
      const s = getSettings();
      if (s.autoSendEnabled !== "true") return;

      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" })
      );
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (currentTime !== s.autoSendTime) return;

      const allowedDays = s.autoSendDays
        .split(",")
        .map((d) => DAY_CODE_TO_JS[d.trim()])
        .filter((n) => n !== undefined);
      if (!allowedDays.includes(now.getDay())) return;

      const data = getTodayOrderData();
      if (data.order.status === "sent") return;

      if (isTodayClosed(data)) {
        console.log("[scheduler] Auto-send přeskočen — dnes je zavřeno.");
        return;
      }

      const activeCount = data.departments
        .flatMap((d) => d.rows)
        .filter(hasOrderRowContent).length;
      const minOrders = parseInt(s.autoSendMinOrders) || 1;
      if (activeCount < minOrders) {
        console.log(`[scheduler] Auto-send přeskočen — pouze ${activeCount} objednávek (min. ${minOrders}).`);
        return;
      }

      console.log(`[scheduler] Automatické odesílání objednávky ${data.order.id}...`);
      await sendOrder(data.order.id, data.order.extraEmail ?? "");
      logAudit({ action: "auto_send", orderId: data.order.id, details: `auto-send v ${currentTime}` });
      console.log("[scheduler] Objednávka automaticky odeslána.");
    } catch (err) {
      console.error("[scheduler] Chyba při automatickém odeslání:", err);
    }
  });

  console.log("[scheduler] Automatický odesílač nastaven.");
}
