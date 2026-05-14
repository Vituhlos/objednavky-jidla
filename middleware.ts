import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "session_token";
const SA_COOKIE_NAME = "sa_session_token";

const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
// Paths within /t/[slug]/ that don't require a session
const TENANT_PUBLIC_SUFFIXES = [
  "/login",
  "/register",
  "/zapomenute-heslo",
  "/reset-hesla",
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

    const isPublicTenantPath = TENANT_PUBLIC_SUFFIXES.some(
      (s) => rest === s || rest.startsWith(`${s}?`)
    );
    if (isPublicTenantPath) return NextResponse.next();

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
    if (pathname === "/super-admin/login") return NextResponse.next();
    const token = request.cookies.get(SA_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }
    return NextResponse.next();
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
