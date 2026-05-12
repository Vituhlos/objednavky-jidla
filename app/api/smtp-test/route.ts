import { type NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, testSmtpConnectionWith } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Nemáte oprávnění." }, { status: 403 });
  }
  if (!checkRateLimit(`smtp-test:${getIp(req)}`, 5, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Příliš mnoho požadavků. Počkejte chvíli." }, { status: 429 });
  }
  try {
    await testSmtpConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Neznámá chyba" });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Nemáte oprávnění." }, { status: 403 });
  }
  if (!checkRateLimit(`smtp-test:${getIp(req)}`, 5, 60 * 1000)) {
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
