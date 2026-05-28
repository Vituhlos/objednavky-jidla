import { requireAuth } from "@/lib/auth";
import { createPairingToken } from "@/lib/mobile-pairing";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireAuth();
    return Response.json(createPairingToken(session.userId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Přihlášení vyžadováno";
    return mobileError("UNAUTHORIZED", message, 401);
  }
}
