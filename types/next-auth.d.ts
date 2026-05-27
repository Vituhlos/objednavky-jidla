import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    userId?: number;
    user: DefaultSession["user"] & {
      role?: "admin" | "user";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    role?: "admin" | "user";
  }
}
