import { getDb } from "@/lib/db";
import { requireMobileAuth, mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  let body: { platform?: string; token?: string; appVersion?: string };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  if (!body.platform || !body.token) {
    return mobileError("BAD_REQUEST", "platform a token jsou povinné", 400);
  }
  if (body.platform !== "ios" && body.platform !== "android") {
    return mobileError("BAD_REQUEST", "platform musí být ios nebo android", 400);
  }

  getDb()
    .prepare(
      `INSERT INTO mobile_device_tokens (user_id, platform, token, app_version)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, token) DO UPDATE SET platform = excluded.platform, app_version = excluded.app_version`,
    )
    .run(auth.userId, body.platform, body.token, body.appVersion ?? null);

  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  if (!body.token) {
    return mobileError("BAD_REQUEST", "token je povinný", 400);
  }

  getDb()
    .prepare("DELETE FROM mobile_device_tokens WHERE user_id = ? AND token = ?")
    .run(auth.userId, body.token);

  return new Response(null, { status: 204 });
}
