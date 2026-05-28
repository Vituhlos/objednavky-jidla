import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (middleware). No DB calls, no Node-only modules —
 * those live in auth.ts so middleware does not bundle better-sqlite3 / scrypt.
 *
 * `authorized` callback je volaný v middleware — určuje, jestli uživatel může
 * přistupovat ke stránce. Vrací `true`/`false`/`Response` (redirect).
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // Soft auth — většina stránek je veřejných. Jen nastavení a profil vyžaduje login.
      const protectedPaths = ["/nastaveni", "/profil"];
      const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
      if (!isProtected) return true;
      return !!auth?.user;
    },
    // Middleware potřebuje role v session — bez toho je session.user.role undefined
    async session({ session, token }) {
      if (typeof token.userId === "number") {
        (session as { userId?: number }).userId = token.userId;
      }
      (session.user as { role?: string }).role = token.role === "admin" ? "admin" : "user";
      return session;
    },
  },
} satisfies NextAuthConfig;
