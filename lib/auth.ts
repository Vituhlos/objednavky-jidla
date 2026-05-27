import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AppSession = {
  userId: number;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: "admin" | "user";
    firstName: string;
    lastName: string;
  };
};

function toAppSession(session: Session | null): AppSession | null {
  if (!session?.user) return null;
  const userId = (session as { userId?: number }).userId;
  if (typeof userId !== "number") return null;
  const u = session.user as { role?: string; firstName?: string; lastName?: string };
  const role = u.role === "admin" ? "admin" : "user";
  return {
    userId,
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
    },
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  return toAppSession(await auth());
}

export async function requireAuth(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) throw new Error("Nejste přihlášeni.");
  return session;
}

export async function requireAdmin(): Promise<AppSession> {
  const session = await requireAuth();
  if (session.user.role !== "admin") throw new Error("Nemáte oprávnění administrátora.");
  return session;
}
