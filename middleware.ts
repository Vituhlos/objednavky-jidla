import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "session_token";
const SA_COOKIE_NAME = "sa_session_token";

const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
// Paths within /t/[slug]/ that don't require a session (exact match or prefix)
const TENANT_PUBLIC_PATHS = [
  "/login",
  "/register",
  "/zapomenute-heslo",
  "/reset-hesla",
  "/api/auth",
];

// Legacy single-tenant public/protected paths (unchanged)
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/zapomenute-heslo",
  "/reset-hesla",
  "/api/auth",
  "/join",
];
const PROTECTED_PATHS = ["/nastaveni"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── /t/[slug]/* — tenant routes ──────────────────────────────────────────
  const tenantMatch = pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (tenantMatch) {
    const slug = tenantMatch[1];
    const rest = tenantMatch[2] ?? "/";

    if (!TENANT_SLUG_RE.test(slug)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const isPublicTenantPath = TENANT_PUBLIC_PATHS.some(
      (s) => rest === s || rest.startsWith(`${s}/`) || rest.startsWith(`${s}?`)
    );
    if (isPublicTenantPath) return NextResponse.next();

    // Edge Runtime can't access SQLite — only presence check here.
    // Actual session validity is enforced by requireTenantAccess() in each server component.
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/t/${slug}/login`, request.url));
    }

    // Forward slug so server components can call getTenantDb(slug) without parsing URL
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-tenant-slug", slug);
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  // ── /super-admin/* — super admin routes ─────────────────────────────────
  if (pathname.startsWith("/super-admin")) {
    const isPublicSA = pathname === "/super-admin/login" || pathname.startsWith("/super-admin/api/auth/");
    if (!isPublicSA) {
      const token = request.cookies.get(SA_COOKIE_NAME)?.value;
      if (!token) {
        return NextResponse.redirect(new URL("/super-admin/login", request.url));
      }
    }
    const res = NextResponse.next();
    res.headers.set("x-is-super-admin", "1");
    return res;
  }

  // ── Join / landing pages — no sidebar ───────────────────────────────────
  if (pathname === "/" || pathname.startsWith("/join")) {
    const res = NextResponse.next();
    res.headers.set("x-no-sidebar", "1");
    return res;
  }

  // ── Legacy single-tenant routes (backward compat during migration) ────────
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|apple-icon|manifest|icons|.*\\.png|.*\\.ico|.*\\.webmanifest).*)",
  ],
};
