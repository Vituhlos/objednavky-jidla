import type { DefaultSession } from "next-auth";

type AppSessionUser = DefaultSession["user"] & {
  role?: "admin" | "user";
};

declare module "next-auth" {
  interface Session {
    userId?: number;
    user: AppSessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    role?: "admin" | "user";
  }
}

declare module "@auth/core/types" {
  interface Session {
    userId?: number;
    user: AppSessionUser;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: number;
    role?: "admin" | "user";
  }
}
