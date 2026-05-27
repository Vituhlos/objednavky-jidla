import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/telegram",
  "/api/ping",
  "/api/version",
  "/login",
  "/registrace",
  "/zapomenute-heslo",
  "/reset-hesla",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/manifest",
  "/sw.js",
];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/nastaveni" || pathname.startsWith("/nastaveni/")) {
    const role = session.user?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/profil?denied=admin", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
