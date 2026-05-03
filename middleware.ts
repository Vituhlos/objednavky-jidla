import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "session_token";
const PROTECTED_PATHS = ["/nastaveni"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
