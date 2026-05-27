import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import QRCode from "qrcode";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const user = getUserById(session.userId);
  if (!user) return new NextResponse("Not found", { status: 404 });

  const name = `${user.firstName} ${user.lastName}`.trim() || user.email || `user-${user.id}`;

  try {
    const png = await QRCode.toBuffer(name, {
      type: "png",
      width: 256,
      margin: 2,
      color: { dark: "#1e293b", light: "#f8f5f0" },
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("QR generation failed", { status: 500 });
  }
}
