import { requireMobileAuth, requireMobileAdmin, mobileError } from "@/lib/mobile-api";
import { getMobileTokensForUser, sendMobilePushToUser, getFcmServerKey } from "@/lib/mobile-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const adminErr = requireMobileAdmin(auth);
  if (adminErr) return adminErr;

  if (!getFcmServerKey()) {
    return mobileError("SERVICE_UNAVAILABLE", "FCM server key není nakonfigurován", 503);
  }

  const tokens = getMobileTokensForUser(auth.userId);
  if (tokens.length === 0) {
    return mobileError("NOT_FOUND", "Žádné registrované push tokeny pro tento účet", 404);
  }

  const result = await sendMobilePushToUser(auth.userId, {
    title: "Test notifikace ✓",
    body: "Mobile push funguje správně.",
    url: "/",
  });

  return Response.json({
    sent: result.sent,
    failed: result.failed,
    dead: result.dead,
    devices: tokens.length,
  });
}
