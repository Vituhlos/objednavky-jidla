import { AuthError } from "./auth/errors";
import { requireAdmin, requireAdminWithPin } from "./auth/guards";

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

function deniedResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    const status = error.code === "NEPRIHLASEN" || error.code === "BLOKOVAN" ? 401 : 403;
    return new Response(error.message, { status });
  }
  throw error;
}

export async function requireApiAdmin(): Promise<Response | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    return deniedResponse(error);
  }
}

export async function requireSettingsAccess(): Promise<Response | null> {
  try {
    await requireAdminWithPin();
    return null;
  } catch (error) {
    return deniedResponse(error);
  }
}
