import { getOrderDataForDate, getTodayOrderData } from "@/lib/orders";
import { requireMobileAuth, parseIsoDate, mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  if (dateParam) {
    const date = parseIsoDate(dateParam);
    if (date instanceof Response) return date;
    try {
      return Response.json(getOrderDataForDate(date));
    } catch {
      return mobileError("INTERNAL", "Chyba načítání objednávky", 500);
    }
  }

  try {
    return Response.json(getTodayOrderData());
  } catch {
    return mobileError("INTERNAL", "Chyba načítání objednávky", 500);
  }
}
