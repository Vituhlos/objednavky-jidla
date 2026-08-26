import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/api-auth";
import { checkRateLimit, isRateLimited } from "@/lib/rate-limit";
import { getCanonicalAppOrigin } from "@/lib/auth/app-url";
import {
  buildGoogleAuthUrl,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_LINK_COOKIE,
  isGoogleConfigured,
  sealGoogleFlowCookie,
} from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function callbackUri(): string {
  return new URL("/api/auth/google/callback", getCanonicalAppOrigin()).href;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateKey = `auth-google-start:${getClientIp(request)}`;
  if (isRateLimited(rateKey, MAX_FAILURES)) {
    return noStore(
      new NextResponse("Příliš mnoho neúspěšných pokusů. Zkuste to za 15 minut.", {
        status: 429,
      })
    );
  }
  if (!isGoogleConfigured()) {
    return noStore(
      new NextResponse("Přihlášení přes Google není nastavené.", { status: 503 })
    );
  }

  try {
    const redirectUri = callbackUri();
    const flow = await buildGoogleAuthUrl(redirectUri);
    const response = NextResponse.redirect(flow.url, { status: 302 });
    response.cookies.set(
      GOOGLE_FLOW_COOKIE,
      sealGoogleFlowCookie({
        state: flow.state,
        nonce: flow.nonce,
        codeVerifier: flow.codeVerifier,
        redirectUri,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/google",
        maxAge: 10 * 60,
      }
    );
    response.cookies.set(GOOGLE_LINK_COOKIE, "", { path: "/", maxAge: 0 });
    return noStore(response);
  } catch {
    checkRateLimit(rateKey, MAX_FAILURES, FAILURE_WINDOW_MS);
    return noStore(
      new NextResponse("Přihlášení přes Google se nepodařilo zahájit.", { status: 503 })
    );
  }
}
