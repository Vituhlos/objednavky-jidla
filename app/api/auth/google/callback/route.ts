import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, isRateLimited } from "@/lib/rate-limit";
import { AuthError } from "@/lib/auth/errors";
import {
  completeGoogleLogin,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_LINK_COOKIE,
  readGoogleFlowCookie,
  sealPendingGoogleLink,
  type PendingGoogleLink,
} from "@/lib/auth/oauth";
import {
  createUserFromGoogle,
  GoogleLinkRequiredError,
} from "@/lib/auth/users";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function finish(response: NextResponse): NextResponse {
  response.cookies.set(GOOGLE_FLOW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function appRedirect(redirectUri: string, status: string): NextResponse {
  const url = new URL("/", redirectUri);
  if (status) url.searchParams.set("auth", status);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawFlow = request.cookies.get(GOOGLE_FLOW_COOKIE)?.value;
  const subject = createHash("sha256").update(rawFlow ?? "missing", "utf8").digest("hex");
  const rateKey = `auth-google-callback:flow:${subject}`;
  const globalRateKey = "auth-google-callback:global";
  if (isRateLimited(rateKey, MAX_FAILURES) || isRateLimited(globalRateKey, 200)) {
    return finish(
      new NextResponse("Příliš mnoho neúspěšných pokusů. Zkuste to za 15 minut.", {
        status: 429,
      })
    );
  }

  const checks = rawFlow ? readGoogleFlowCookie(rawFlow) : null;
  if (!checks) {
    checkRateLimit(rateKey, MAX_FAILURES, FAILURE_WINDOW_MS);
    checkRateLimit(globalRateKey, 200, FAILURE_WINDOW_MS);
    return finish(new NextResponse("Přihlášení přes Google vypršelo.", { status: 400 }));
  }

  let profile: PendingGoogleLink | null = null;
  try {
    profile = await completeGoogleLogin(new URL(request.url), checks);
    const account = createUserFromGoogle({
      email: profile.email,
      name: profile.name,
      subject: profile.subject,
      departmentId: null,
    });
    const session = createSession(account.userId, {
      persistent: false,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    const response = appRedirect(checks.redirectUri, "google-ok");
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      getSessionCookieOptions(false, session.expiresAt)
    );
    response.cookies.set(GOOGLE_LINK_COOKIE, "", { path: "/", maxAge: 0 });
    return finish(response);
  } catch (error) {
    if (error instanceof GoogleLinkRequiredError && profile) {
      const response = appRedirect(checks.redirectUri, "google-link-required");
      response.cookies.set(GOOGLE_LINK_COOKIE, sealPendingGoogleLink(profile), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 10 * 60,
      });
      return finish(response);
    }
    if (error instanceof AuthError && error.code === "BLOKOVAN") {
      return finish(appRedirect(checks.redirectUri, "blocked"));
    }

    checkRateLimit(rateKey, MAX_FAILURES, FAILURE_WINDOW_MS);
    checkRateLimit(globalRateKey, 200, FAILURE_WINDOW_MS);
    return finish(appRedirect(checks.redirectUri, "google-failed"));
  }
}
