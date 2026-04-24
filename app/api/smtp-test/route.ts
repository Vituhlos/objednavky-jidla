import { type NextRequest, NextResponse } from "next/server";
import { testSmtpConnection } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!checkRateLimit(`smtp-test:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Příliš mnoho požadavků. Počkejte chvíli." }, { status: 429 });
  }
  try {
    await testSmtpConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Neznámá chyba" },
      { status: 200 }
    );
  }
}
