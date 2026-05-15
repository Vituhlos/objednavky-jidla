import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/tenant-auth";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  try {
    await requireTenantAdmin(tenantSlug);
  } catch {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }
  try {
    const items = await scrapePizzaMenu();
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Nepodařilo se načíst žádné pizzy z webu. Web možná změnil strukturu." },
        { status: 422 }
      );
    }
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Neznámá chyba" },
      { status: 500 }
    );
  }
}
