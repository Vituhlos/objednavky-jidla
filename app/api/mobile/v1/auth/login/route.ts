import { checkRateLimit } from "@/lib/rate-limit";
import { verifyUserPassword, getUserById } from "@/lib/users";
import { issueTokenPair, refreshTokenPair, revokeRefreshToken } from "@/lib/mobile-auth";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return mobileError("BAD_REQUEST", "Neplatný JSON", 400);
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return mobileError("BAD_REQUEST", "E-mail a heslo jsou povinné", 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`mobile-login:${ip}`, 10, 15 * 60 * 1000)) {
    return mobileError("RATE_LIMITED", "Příliš mnoho pokusů. Zkuste to později.", 429);
  }

  const verified = verifyUserPassword(email, password);
  if (!verified) {
    return mobileError("UNAUTHORIZED", "Neplatný e-mail nebo heslo", 401);
  }

  const user = getUserById(verified.id);
  if (!user || !user.active) {
    return mobileError("UNAUTHORIZED", "Účet není aktivní", 401);
  }

  return Response.json(issueTokenPair(user));
}
