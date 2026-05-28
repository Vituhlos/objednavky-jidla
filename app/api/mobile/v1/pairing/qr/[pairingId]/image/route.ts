import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPairingQrPayload } from "@/lib/mobile-pairing";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pairingId: string }> },
) {
  try {
    const session = await requireAuth();
    const { pairingId } = await params;
    const qrPayload = getPairingQrPayload(pairingId, session.userId);
    if (!qrPayload) return mobileError("NOT_FOUND", "QR kód není k dispozici", 404);

    const png = await QRCode.toBuffer(qrPayload, {
      type: "png",
      width: 256,
      margin: 2,
      color: { dark: "#1e293b", light: "#f8f5f0" },
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Přihlášení vyžadováno";
    return mobileError("UNAUTHORIZED", message, 401);
  }
}
