import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import OIDC from "next-auth/providers/oidc";
import { upsertUserFromOidc } from "@/lib/users";

const config: NextAuthConfig = {
  // In beta versions this is still sometimes called NEXTAUTH_SECRET in docs;
  // we support both names to avoid footguns across environments.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    OIDC({
      id: "oidc",
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      if (account?.provider && account.providerAccountId) {
        const email = typeof profile?.email === "string" ? profile.email : null;
        const name = typeof profile?.name === "string" ? profile.name : null;
        const avatarUrl = typeof profile?.picture === "string" ? profile.picture : null;

        const user = upsertUserFromOidc({
          provider: account.provider,
          subject: account.providerAccountId,
          email,
          name,
          avatarUrl,
        });

        token.userId = user.id;
        token.role = user.role;
      } else if (trigger === "update" && token.userId) {
        const { getUserById } = await import("@/lib/users");
        const user = getUserById(token.userId);
        if (user) token.role = user.role === "admin" ? "admin" : "user";
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = typeof token.userId === "number" ? token.userId : undefined;
      session.user.role = token.role === "admin" ? "admin" : "user";
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

