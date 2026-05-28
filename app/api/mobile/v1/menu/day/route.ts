import { getDayCodeForISO, getMenuItemsForDay, getMondayISO } from "@/lib/menu";
import { parseIsoDate, mobileError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const dateParam = parseIsoDate(new URL(request.url).searchParams.get("date"));
  if (dateParam instanceof Response) return dateParam;

  const dayCode = getDayCodeForISO(dateParam);
  const weekStart = getMondayISO(dateParam);
  const menu = dayCode ? getMenuItemsForDay(dayCode, weekStart) : { soups: [], meals: [] };
  const closed = menu.meals.length === 1 && menu.meals[0]?.name === "Zavřeno";

  return Response.json({
    date: dateParam,
    dayCode,
    weekStart,
    soups: menu.soups,
    meals: menu.meals,
    closed,
  });
}
