import { NextResponse } from "next/server";
import { scrapePizzaMenu } from "@/lib/pizza-scraper";
import { getSettings } from "@/lib/settings";

export async function GET() {
  if (getSettings().pizzaEnabled === "false") {
    return NextResponse.json({ error: "Pizza modul je vypnutý." }, { status: 404 });
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
