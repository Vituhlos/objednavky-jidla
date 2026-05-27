import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AppSession = {
  userId: number;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: "admin" | "user";
  };
};

function toAppSession(session: Session | null): AppSession | null {
  if (!session?.user) return null;
  const userId = (session as { userId?: number }).userId;
  if (typeof userId !== "number") return null;
  const role = (session.user as { role?: string }).role === "admin" ? "admin" : "user";
  return {
    userId,
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role,
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
