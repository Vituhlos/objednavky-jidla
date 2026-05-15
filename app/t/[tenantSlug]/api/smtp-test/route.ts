import { type NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, testSmtpConnectionWith } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireTenantAdmin } from "@/lib/tenant-auth";
import { setTenantSlug } from "@/lib/tenant-context";
import { getTenantDb } from "@/lib/tenant-db";

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

async function guardAdmin(tenantSlug: string) {
  setTenantSlug(tenantSlug);
  try {
    await requireTenantAdmin(tenantSlug);
  } catch {
    return NextResponse.json({ ok: false, error: "Nemáte oprávnění." }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const guard = await guardAdmin(tenantSlug);
  if (guard) return guard;

  const db = getTenantDb(tenantSlug);
  if (!checkRateLimit(`smtp-test:${getIp(req)}`, 5, 60_000, db)) {
    return NextResponse.json({ ok: false, error: "Příliš mnoho požadavků. Počkejte chvíli." }, { status: 429 });
  }
  try {
    await testSmtpConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Neznámá chyba" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const guard = await guardAdmin(tenantSlug);
  if (guard) return guard;

  const db = getTenantDb(tenantSlug);
  if (!checkRateLimit(`smtp-test:${getIp(req)}`, 5, 60_000, db)) {
    return NextResponse.json({ ok: false, error: "Příliš mnoho požadavků. Počkejte chvíli." }, { status: 429 });
  }
  try {
    const body = await req.json() as { host: string; port: string; user: string; pass: string; secure: string };
    await testSmtpConnectionWith(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Neznámá chyba" });
  }
}
