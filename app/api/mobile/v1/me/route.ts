import { getUserById, updateUserProfile } from "@/lib/users";
import { requireMobileAuth, toUserProfile, mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const user = getUserById(auth.userId);
  if (!user) return mobileError("NOT_FOUND", "Uživatel nenalezen", 404);
  return Response.json(toUserProfile(user));
}

export async function PATCH(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  let body: {
    firstName?: string;
    lastName?: string;
    defaultDepartment?: string | null;
    emailOrderConfirmation?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  try {
    updateUserProfile(auth.userId, body);
  } catch (e) {
    return mobileError("BAD_REQUEST", e instanceof Error ? e.message : "Chyba uložení", 400);
  }

  const user = getUserById(auth.userId);
  if (!user) return mobileError("NOT_FOUND", "Uživatel nenalezen", 404);
  return Response.json(toUserProfile(user));
}
