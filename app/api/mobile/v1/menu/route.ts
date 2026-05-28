import { getFullMenu } from "@/lib/menu";
import { mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const weekStart = new URL(request.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return mobileError("BAD_REQUEST", "Parametr weekStart (YYYY-MM-DD) je povinný", 400);
  }

  return Response.json({ weekStart, days: getFullMenu(weekStart) });
}
