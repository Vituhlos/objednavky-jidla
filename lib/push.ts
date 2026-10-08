import webpush from "web-push";
import { getDb } from "./db";
import { getSettings, saveSettings } from "./settings";

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function getOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
  const s = getSettings();
  if (s.vapidPublicKey && s.vapidPrivateKey) {
    return { publicKey: s.vapidPublicKey, privateKey: s.vapidPrivateKey };
  }
  const keys = webpush.generateVAPIDKeys();
  saveSettings({ vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey });
  return keys;
}

export function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  getDb()
    .prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth")
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}

export function deleteSubscription(endpoint: string): void {
  getDb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function getAllSubscriptions(): PushSubscriptionRow[] {
  return getDb().prepare("SELECT * FROM push_subscriptions").all() as PushSubscriptionRow[];
}

/** Prohlížeče, které mají v objednávce vyplněný řádek (jídlo nebo polévku). */
export function getOrderedPushEndpoints(orderId: number): Set<string> {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT push_endpoint FROM order_rows
       WHERE order_id = ? AND push_endpoint IS NOT NULL
         AND (main_item_id IS NOT NULL OR soup_item_id IS NOT NULL
              OR (extra_meals IS NOT NULL AND extra_meals NOT IN ('', '[]')))`
    )
    .all(orderId) as { push_endpoint: string }[];
  return new Set(rows.map((r) => r.push_endpoint));
}

export async function sendPushToAll(title: string, body: string, url = "/"): Promise<void> {
  await sendPush(getAllSubscriptions(), { title, body, url });
}

/**
 * Dá vědět, že objednávka odešla — jen prohlížečům, které v ní mají vyplněný
 * řádek. Vlastní `tag`, aby notifikace nenahradila připomínku uzávěrky potichu.
 */
export async function sendOrderSentPush(orderId: number, sentAt: string): Promise<void> {
  const endpoints = getOrderedPushEndpoints(orderId);
  if (endpoints.size === 0) return;

  const time = new Date(sentAt).toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
  await sendPush(
    getAllSubscriptions().filter((s) => endpoints.has(s.endpoint)),
    { title: "Objednávka odeslána ✓", body: `Dnešní obědy odešly v ${time}.`, url: "/", tag: "objednavky-odeslano" },
  );
}

/** Pošle notifikaci daným odběrům a uklidí ty, které prohlížeč mezitím odvolal. */
export async function sendPush(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<void> {
  if (subs.length === 0) return;
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails("mailto:app@localhost", publicKey, privateKey);

  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(row.endpoint);
        else console.warn("[push] Chyba odeslání:", (err as Error).message);
      }
    }),
  );

  // Smaž mrtvé subscriptions (prohlížeč je odvolal)
  for (const ep of dead) deleteSubscription(ep);
  if (dead.length) console.log(`[push] Odstraněno ${dead.length} expirovaných subscriptions.`);
}
