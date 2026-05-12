import { NextResponse } from "next/server";
import { getOrCreateVapidKeys, saveSubscription, deleteSubscription } from "@/lib/push";

export function GET() {
  const { publicKey } = getOrCreateVapidKeys();
  return NextResponse.json({ publicKey });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Neplatná subscription" }, { status: 400 });
  }
  saveSubscription(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  if (!body?.endpoint) return NextResponse.json({ error: "Chybí endpoint" }, { status: 400 });
  deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
