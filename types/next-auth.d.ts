import type { DefaultSession } from "next-auth";

type AppSessionUser = DefaultSession["user"] & {
  role?: "admin" | "user";
  firstName?: string;
  lastName?: string;
};

declare module "next-auth" {
  interface Session {
    userId?: number;
    sessionVersion?: number;
    user: AppSessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    sessionVersion?: number;
    role?: "admin" | "user";
    firstName?: string;
    lastName?: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    userId?: number;
    sessionVersion?: number;
    user: AppSessionUser;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: number;
    sessionVersion?: number;
    role?: "admin" | "user";
    firstName?: string;
    lastName?: string;
  }
}
