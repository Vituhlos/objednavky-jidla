import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
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
