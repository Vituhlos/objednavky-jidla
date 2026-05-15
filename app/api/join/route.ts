import { NextRequest, NextResponse } from "next/server";
import { getGlobalDb } from "@/lib/global-db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { code?: string } | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Zadejte registrační kód." }, { status: 400 });

  const tenant = getGlobalDb()
    .prepare("SELECT slug FROM tenants WHERE join_code = ? AND active = 1")
    .get(code) as { slug: string } | undefined;

  if (!tenant) {
    return NextResponse.json({ error: "Neplatný registrační kód. Ověřte kód u správce kantýny." }, { status: 404 });
  }

  return NextResponse.json({ slug: tenant.slug });
}
