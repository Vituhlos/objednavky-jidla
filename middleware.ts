import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "session_token";

// Vše ostatní vyžaduje přihlášení — přidej sem pouze skutečně veřejné cesty
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/zapomenute-heslo",
  "/reset-hesla",
  "/api/auth",
  "/api/telegram/webhook", // externí webhook — má vlastní ochranu (secret token)
];

// Stránky přístupné i bez přihlášení (čtení/prohlížení)
const GUEST_PATHS = ["/jidelnicek", "/api/sse", "/api/order-refresh"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Hlavní stránka a jídelníček jsou přístupné i bez přihlášení
  if (pathname === "/" || GUEST_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

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
