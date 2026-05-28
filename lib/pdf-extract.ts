import { getDocumentProxy } from "unpdf";

export async function extractStructuredText(buf: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buf);
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, { x: number; w: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round((item as { transform: number[] }).transform[5] * 2) / 2;
      const x = (item as { transform: number[] }).transform[4];
      const w = (item as { width?: number }).width ?? 0;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, w, str: item.str });
    }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      let line = items[0].str;
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const curr = items[i];
        line += (curr.x - (prev.x + prev.w) > 1 ? " " : "") + curr.str;
      }
      lines.push(line);
    }
  }
  return lines.join("\n");
}
