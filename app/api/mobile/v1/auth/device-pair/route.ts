import { consumePairingToken } from "@/lib/mobile-pairing";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  if (!body.token) {
    return mobileError("BAD_REQUEST", "Chybí token", 400);
  }

  const result = consumePairingToken(body.token);
  if ("error" in result) {
    const map = {
      INVALID: { code: "PAIRING_INVALID", message: "Neplatný QR kód", status: 400 },
      USED: { code: "PAIRING_USED", message: "QR kód už byl použit", status: 410 },
      EXPIRED: { code: "PAIRING_EXPIRED", message: "QR kód vypršel", status: 410 },
    } as const;
    const err = map[result.error];
    return mobileError(err.code, err.message, err.status);
  }

  return Response.json(result.tokens);
}
