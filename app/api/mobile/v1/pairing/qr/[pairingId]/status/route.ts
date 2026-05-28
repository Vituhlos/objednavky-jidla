import { requireAuth } from "@/lib/auth";
import { getPairingStatus } from "@/lib/mobile-pairing";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pairingId: string }> },
) {
  try {
    const session = await requireAuth();
    const { pairingId } = await params;
    const status = getPairingStatus(pairingId, session.userId);
    if (!status) return mobileError("NOT_FOUND", "Párování nenalezeno", 404);
    return Response.json({ status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Přihlášení vyžadováno";
    return mobileError("UNAUTHORIZED", message, 401);
  }
}
