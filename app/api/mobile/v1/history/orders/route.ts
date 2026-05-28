import { getOrderListWithDepts } from "@/lib/orders";
import { requireMobileAuth } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireMobileAuth(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
  const cursor = searchParams.get("cursor");

  const all = getOrderListWithDepts();
  let start = 0;
  if (cursor) {
    const idx = all.findIndex((o) => String(o.id) === cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }

  const slice = all.slice(start, start + limit);
  const nextCursor =
    start + limit < all.length && slice.length > 0
      ? String(slice[slice.length - 1]!.id)
      : null;

  return Response.json({ items: slice, nextCursor });
}
