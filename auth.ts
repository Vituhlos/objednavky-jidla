import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import {
  verifyUserPassword,
  upsertUserFromOAuth,
  getUserById,
  linkProviderAccount,
} from "@/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(creds) {
        const email = typeof creds?.email === "string" ? creds.email.trim().toLowerCase() : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!email || !password) return null;
        const result = verifyUserPassword(email, password);
        if (!result) return null;
        return {
          id: String(result.id),
          email: result.email,
          name: `${result.firstName} ${result.lastName}`.trim() || result.email,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Auto-link: vyžadujeme verifikovaný email z Googlu
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Credentials prošlo přes authorize — id je už interní user.id
      if (account?.provider === "credentials") return true;

      // Google login — auto-link by email pokud Google ověřil email
      if (account?.provider === "google") {
        const email = typeof profile?.email === "string" ? profile.email.toLowerCase() : null;
        const emailVerified = (profile as { email_verified?: boolean })?.email_verified === true;
        const name = typeof profile?.name === "string" ? profile.name : null;
        const avatarUrl = typeof profile?.picture === "string" ? profile.picture : null;
        const sub = account.providerAccountId;
        if (!email || !sub) return false;

        const result = upsertUserFromOAuth({
          provider: "google",
          providerAccountId: sub,
          email,
          emailVerified,
          name,
          avatarUrl,
        });
        // Přiřadíme user.id pro JWT callback (přes user objekt v Auth.js v5)
        (user as { id?: string }).id = String(result.id);
        return true;
      }

      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Po prvním přihlášení — uložit userId + role do JWT
      if (user?.id) {
        const userId = Number(user.id);
        if (Number.isFinite(userId)) {
          const u = getUserById(userId);
          if (u) {
            token.userId = u.id;
            token.role = u.role === "admin" ? "admin" : "user";
            token.firstName = u.firstName;
            token.lastName = u.lastName;
            token.sessionVersion = u.sessionVersion;
          }
        }
      } else if (trigger === "update" && typeof token.userId === "number") {
        const u = getUserById(token.userId);
        if (u) {
          token.role = u.role === "admin" ? "admin" : "user";
          token.firstName = u.firstName;
          token.lastName = u.lastName;
          token.sessionVersion = u.sessionVersion;
        }
      }

      // Zaznamenat účet (link provider, ale jen poprvé)
      if (account && typeof token.userId === "number") {
        try {
          linkProviderAccount(token.userId, account.provider, account.providerAccountId);
        } catch {}
      }

      return token;
    },
    async session({ session, token }) {
      const out = session as import("next-auth").Session;
      if (typeof token.userId === "number") out.userId = token.userId;
      if (typeof token.sessionVersion === "number") out.sessionVersion = token.sessionVersion;
      out.user = {
        ...out.user,
        role: token.role === "admin" ? "admin" : "user",
        firstName: (token.firstName as string | undefined) ?? "",
        lastName: (token.lastName as string | undefined) ?? "",
      };
      return out;
    },
  },
});
