import { refreshTokenPair } from "@/lib/mobile-auth";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { refreshToken?: string };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  if (!body.refreshToken) {
    return mobileError("BAD_REQUEST", "Chybí refreshToken", 400);
  }

  const tokens = refreshTokenPair(body.refreshToken);
  if (!tokens) {
    return mobileError("UNAUTHORIZED", "Neplatný nebo expirovaný refresh token", 401);
  }

  return Response.json(tokens);
}
