import { isIP } from "node:net";
import { AuthError } from "./auth/errors";
import { requireAdmin, requireAdminWithPin } from "./auth/guards";

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}

export function getClientIpFromHeaders(headers: Pick<Headers, "get">): string {
  // Bez výslovně potvrzeného a síťově uzavřeného Cloudflare ingressu je každá
  // forwarded hlavička vstup útočníka. Sdílený klíč je přísnější, ale nejde
  // obejít pouhým střídáním X-Forwarded-For.
  if (process.env.TRUST_CLOUDFLARE_PROXY !== "true") return "untrusted";
  const candidate = headers.get("cf-connecting-ip")?.trim() ?? "";
  return isIP(candidate) ? candidate : "untrusted";
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
