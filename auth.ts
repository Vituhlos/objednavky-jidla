import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import AppOidcProvider from "@/lib/oidc-provider";
import { upsertUserFromOidc } from "@/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    AppOidcProvider({
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
        token.roleCheckedAt = Date.now();
      } else if (trigger === "update" && typeof token.userId === "number") {
        const { getUserById } = await import("@/lib/users");
        const user = getUserById(token.userId);
        if (user) token.role = user.role === "admin" ? "admin" : "user";
        token.roleCheckedAt = Date.now();
      } else if (typeof token.userId === "number") {
        const ROLE_REFRESH_MS = 60_000;
        const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
        if (Date.now() - checkedAt > ROLE_REFRESH_MS) {
          const { getUserById } = await import("@/lib/users");
          const user = getUserById(token.userId);
          if (user) token.role = user.role === "admin" ? "admin" : "user";
          token.roleCheckedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      const out = session as import("next-auth").Session;
      if (typeof token.userId === "number") out.userId = token.userId;
      out.user = {
        ...out.user,
        role: token.role === "admin" ? "admin" : "user",
      };
      return out;
    },
  },
});
