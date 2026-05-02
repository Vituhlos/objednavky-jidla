import { NextResponse } from "next/server";

interface ScrapedPizza {
  code: number;
  name: string;
  price: number;
}

function parseHtml(html: string): ScrapedPizza[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[123]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#160;/gi, " ")
    .replace(/\r/g, "");

  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const result: ScrapedPizza[] = [];
  let pendingCode: number | null = null;
  let pendingName: string | null = null;

  for (const line of lines) {
    const itemMatch = line.match(/^(\d+)\.\s*(.+)$/);
    const priceMatch = line.match(/^(\d+)\s*Kč$/i);

    if (itemMatch) {
      pendingCode = Number(itemMatch[1]);
      pendingName = itemMatch[2].trim();
      continue;
    }
    if (priceMatch && pendingCode !== null && pendingName !== null) {
      if (pendingCode >= 1 && pendingCode <= 30) {
        result.push({ code: pendingCode, name: pendingName, price: Number(priceMatch[1]) });
      }
      pendingCode = null;
      pendingName = null;
    }
  }

  return result;
}

export async function GET() {
  try {
    const res = await fetch("https://www.pizza-dublovice.cz/menu/pizza/", {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const html = await res.text();
    const items = parseHtml(html);
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
