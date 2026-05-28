import { revokeRefreshToken, requireMobileSession } from "@/lib/mobile-auth";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireMobileSession(request)) {
    return mobileError("UNAUTHORIZED", "Přihlášení vyžadováno", 401);
  }

  let body: { refreshToken?: string } = {};
  try {
    body = await request.json();
  } catch {
    // logout without body still ok if bearer valid
  }

  if (body.refreshToken) {
    revokeRefreshToken(body.refreshToken);
  }

  return new Response(null, { status: 204 });
}
