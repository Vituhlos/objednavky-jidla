import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (middleware). No DB, no OIDC provider module —
 * those live in auth.ts so middleware does not bundle better-sqlite3.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
} satisfies NextAuthConfig;
