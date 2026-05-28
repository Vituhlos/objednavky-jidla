import { getHistoryStats } from "@/lib/orders";
import { requireMobileAuth } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  return Response.json(getHistoryStats());
}
