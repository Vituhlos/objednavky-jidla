import { NextResponse } from "next/server";
import { getOrCreateVapidKeys, saveSubscription, deleteSubscription } from "@/lib/push";
import { getAppSession } from "@/lib/auth";

export function GET() {
  const { publicKey } = getOrCreateVapidKeys();
  return NextResponse.json({ publicKey });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Přihlášení vyžadováno" }, { status: 401 });
  const body = await req.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Neplatná subscription" }, { status: 400 });
  }
  saveSubscription(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Přihlášení vyžadováno" }, { status: 401 });
  const body = await req.json();
  if (!body?.endpoint) return NextResponse.json({ error: "Chybí endpoint" }, { status: 400 });
  deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
