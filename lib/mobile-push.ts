import { getDb } from "./db";
import { getSettings } from "./settings";

export interface MobilePushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface MobileDeviceTokenRow {
  id: number;
  user_id: number;
  platform: string;
  token: string;
  app_version: string | null;
}

const FCM_URL = "https://fcm.googleapis.com/fcm/send";

const DEAD_TOKEN_ERRORS = new Set([
  "NotRegistered",
  "InvalidRegistration",
  "MismatchSenderId",
  "InvalidApnsCredential",
]);

export function getFcmServerKey(): string | null {
  const fromSettings = getSettings().fcmServerKey.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.FCM_SERVER_KEY?.trim();
  return fromEnv || null;
}

export function getAllMobileTokens(): MobileDeviceTokenRow[] {
  return getDb()
    .prepare("SELECT id, user_id, platform, token, app_version FROM mobile_device_tokens")
    .all() as MobileDeviceTokenRow[];
}

export function getMobileTokensForUser(userId: number): MobileDeviceTokenRow[] {
  return getDb()
    .prepare(
      "SELECT id, user_id, platform, token, app_version FROM mobile_device_tokens WHERE user_id = ?",
    )
    .all(userId) as MobileDeviceTokenRow[];
}

function deleteMobileToken(token: string): void {
  getDb().prepare("DELETE FROM mobile_device_tokens WHERE token = ?").run(token);
}

async function sendFcmToToken(
  serverKey: string,
  row: MobileDeviceTokenRow,
  payload: MobilePushPayload,
): Promise<"sent" | "dead" | "failed"> {
  const url = payload.url ?? "/";
  try {
    const res = await fetch(FCM_URL, {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: row.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          url,
          title: payload.title,
          body: payload.body,
        },
        priority: "high",
      }),
    });

    if (!res.ok) {
      console.warn(`[mobile-push] FCM HTTP ${res.status} pro ${row.platform}:`, await res.text());
      return "failed";
    }

    const json = (await res.json()) as {
      success?: number;
      failure?: number;
      results?: { message_id?: string; error?: string }[];
    };
    const result = json.results?.[0];
    if (result?.message_id) return "sent";

    const err = result?.error;
    if (err && DEAD_TOKEN_ERRORS.has(err)) {
      deleteMobileToken(row.token);
      console.log(`[mobile-push] Odstraněn neplatný token (${row.platform}, ${err}).`);
      return "dead";
    }

    if (err) console.warn(`[mobile-push] FCM chyba pro ${row.platform}:`, err);
    return "failed";
  } catch (err) {
    console.warn("[mobile-push] Odeslání selhalo:", (err as Error).message);
    return "failed";
  }
}

async function sendToRows(
  rows: MobileDeviceTokenRow[],
  payload: MobilePushPayload,
): Promise<{ sent: number; failed: number; dead: number }> {
  const serverKey = getFcmServerKey();
  if (!serverKey) {
    console.warn("[mobile-push] FCM server key není nastaven — push přeskočen.");
    return { sent: 0, failed: 0, dead: 0 };
  }
  if (rows.length === 0) return { sent: 0, failed: 0, dead: 0 };

  const outcomes = await Promise.all(rows.map((row) => sendFcmToToken(serverKey, row, payload)));
  return {
    sent: outcomes.filter((o) => o === "sent").length,
    failed: outcomes.filter((o) => o === "failed").length,
    dead: outcomes.filter((o) => o === "dead").length,
  };
}

export async function sendMobilePushToUser(
  userId: number,
  payload: MobilePushPayload,
): Promise<{ sent: number; failed: number; dead: number }> {
  return sendToRows(getMobileTokensForUser(userId), payload);
}

export async function sendMobilePushToAll(
  payload: MobilePushPayload,
  options?: { excludeUserIds?: Iterable<number> },
): Promise<{ sent: number; failed: number; dead: number; skipped: number }> {
  const excluded = options?.excludeUserIds ? new Set(options.excludeUserIds) : null;
  const all = getAllMobileTokens();
  const rows = excluded ? all.filter((row) => !excluded.has(row.user_id)) : all;
  const result = await sendToRows(rows, payload);
  return { ...result, skipped: all.length - rows.length };
}
