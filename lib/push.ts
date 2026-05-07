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

export async function sendPushToAll(title: string, body: string, url = "/"): Promise<void> {
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails("mailto:app@localhost", publicKey, privateKey);

  const subs = getAllSubscriptions();
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title, body, url }),
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
