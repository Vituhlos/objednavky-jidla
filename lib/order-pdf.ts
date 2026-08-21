import PDFDocument from "pdfkit";
import path from "path";

// V kontejneru jsou fonty na této cestě. PDF_FONT_DIR umožní spustit
// generátor i mimo Docker (např. tools/order-pdf.test.mjs na Windows).
const FONT_DIR = process.env.PDF_FONT_DIR || "/usr/share/fonts/truetype/dejavu";
const FONT = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");
const FONT_ITALIC = path.join(FONT_DIR, "DejaVuSans-Oblique.ttf");
import { PassThrough } from "stream";
import { type DepartmentData, type OrderData, type OrderRowEnriched } from "./types";
import { getSubmittedRows } from "./order-utils";

async function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
    doc.end();
  });
}

function departmentFileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Oddeleni"
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function consolidateSoups(row: OrderRowEnriched): Array<{ soup: NonNullable<OrderRowEnriched["soupItem"]>; count: number }> {
  const groups: Array<{ soup: NonNullable<OrderRowEnriched["soupItem"]>; count: number }> = [];
  for (const soup of [row.soupItem, row.soupItem2]) {
    if (!soup) continue;
    const existing = groups.find((g) => g.soup.id === soup.id);
    if (existing) existing.count++;
    else groups.push({ soup, count: 1 });
  }
  return groups;
}

function extraCell(row: OrderRowEnriched): string {
  const parts: string[] = [];
  if (row.rollCount > 0) parts.push(`${row.rollCount}× Houska`);
  if (row.breadDumplingCount > 0) parts.push(`${row.breadDumplingCount}× Hous. knedlík`);
  if (row.potatoDumplingCount > 0) parts.push(`${row.potatoDumplingCount}× Bram. knedlík`);
  if (row.ketchupCount > 0) parts.push(`${row.ketchupCount}× Kečup`);
  if (row.tatarkaCount > 0) parts.push(`${row.tatarkaCount}× Tatarka`);
  if (row.bbqCount > 0) parts.push(`${row.bbqCount}× BBQ omáčka`);
  return parts.join(", ");
}

// landscape A4: 841.89 x 595.28 pt
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 28;
const TABLE_X = MARGIN;
const TABLE_W = PAGE_W - 2 * MARGIN; // 785.89

// Header row background — muted steel-blue (lighter than the original dark navy)
const TABLE_HEADER_BG = "#4E7A8E";

interface ColDef {
  header: string;
  width: number;
  align: "left" | "center" | "right";
  value: (row: OrderRowEnriched, idx: number) => string;
}

// widths sum to TABLE_W (785.89)
const COL_DEFS: ColDef[] = [
  { header: "#",        width: 22,     align: "center", value: (_, i) => String(i + 1) },
  { header: "Jméno",    width: 105,    align: "left",   value: (r) => r.personName || "–" },
  { header: "Polévka",  width: 130,    align: "left",   value: (r) => {
    const groups = consolidateSoups(r);
    if (groups.length === 0) return "–";
    return groups.map(({ soup, count }) => {
      const prefix = count > 1 ? `${count}× ` : "";
      return soup.code ? `${prefix}${soup.code}  ${soup.name}` : `${prefix}${soup.name}`;
    }).join("\n");
  } },
  { header: "Jídlo",    width: 210,    align: "left",   value: (r) => {
    const parts: string[] = [];
    if (r.mainItem) parts.push(`${(r.mealCount || 1) > 1 ? `${r.mealCount}× ` : ""}${r.mainItem.code}  ${r.mainItem.name}`);
    for (const { item, count } of r.extraMealItems) parts.push(`${count > 1 ? `${count}× ` : ""}${item.code}  ${item.name}`);
    return parts.length > 0 ? parts.join("\n+ ") : "–";
  } },
  { header: "Přílohy",  width: 122,    align: "left",   value: (r) => extraCell(r) },
  { header: "Poznámka", width: 196.89, align: "left",   value: (r) => r.note || "" },
];

const HEADER_H = 21;
const FONT_BODY = 10;
const FONT_HEADER = 9;
const ROW_PAD = 10;

// Patička se tiskne na PAGE_H - MARGIN - 10; obsah musí skončit nad ní.
const FOOTER_RESERVE = 22;
const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_RESERVE;
// Nadpis oddělení + hlavička tabulky + nejnižší možný řádek — pod tím
// nemá smysl sekci na stránce vůbec začínat.
const SECTION_MIN_H = 15 + HEADER_H + 20;

function calcRowHeight(doc: PDFKit.PDFDocument, row: OrderRowEnriched, idx: number): number {
  doc.font(FONT).fontSize(FONT_BODY);
  let maxH = 0;
  for (const col of COL_DEFS) {
    const text = col.value(row, idx);
    const h = doc.heightOfString(text, { width: col.width - 6 });
    if (h > maxH) maxH = h;
  }
  return Math.max(maxH + ROW_PAD, 20);
}

function cellVCenter(doc: PDFKit.PDFDocument, font: string, text: string, width: number, y: number, rh: number): number {
  const h = doc.font(font).fontSize(FONT_BODY).heightOfString(text, { width });
  return y + Math.max(0, (rh - h) / 2);
}

function drawMealCell(
  doc: PDFKit.PDFDocument,
  row: OrderRowEnriched,
  x: number,
  y: number,
  width: number,
  rh: number,
) {
  const lines: Array<{ code: string; rest: string }> = [];
  if (row.mainItem) {
    const countPfx = (row.mealCount || 1) > 1 ? `${row.mealCount}× ` : "";
    lines.push({ code: row.mainItem.code || "", rest: `${countPfx}${row.mainItem.name}` });
  }
  for (const { item, count } of row.extraMealItems) {
    const countPfx = count > 1 ? `${count}× ` : "";
    lines.push({ code: item.code || "", rest: `+ ${countPfx}${item.name}` });
  }

  if (lines.length === 0) {
    doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
      .text("–", x + 3, y + 4, { width: width - 6 });
    return;
  }

  const lineHeights = lines.map(line => {
    const full = line.code ? `${line.code}  ${line.rest}` : line.rest;
    return doc.font(FONT).fontSize(FONT_BODY).heightOfString(full, { width: width - 6 });
  });
  const totalH = lineHeights.reduce((s, h) => s + h, 0);
  let lineY = y + Math.max(0, (rh - totalH) / 2);

  lines.forEach((line, i) => {
    if (line.code) {
      doc.font(FONT_BOLD).fontSize(FONT_BODY).fillColor("#30343A")
        .text(line.code, x + 3, lineY, { lineBreak: false });
      const codeW = doc.font(FONT_BOLD).fontSize(FONT_BODY).widthOfString(line.code + "  ");
      doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
        .text(line.rest, x + 3 + codeW, lineY, { width: width - 6 - codeW, lineBreak: false });
    } else {
      doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
        .text(line.rest, x + 3, lineY, { width: width - 6, lineBreak: false });
    }
    lineY += lineHeights[i];
  });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(TABLE_X, y, TABLE_W, HEADER_H).fill(TABLE_HEADER_BG);
  let x = TABLE_X;
  doc.font(FONT_BOLD).fontSize(FONT_HEADER).fillColor("#F5F1E8");
  for (const col of COL_DEFS) {
    doc.text(col.header, x + 3, y + 7, { width: col.width - 6, align: col.align, lineBreak: false });
    x += col.width;
  }
  return y + HEADER_H;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  row: OrderRowEnriched,
  idx: number,
  y: number,
  rh: number,
) {
    const hasNote = !!row.note?.trim();
    const bg = hasNote ? "#FFFBEB" : (idx % 2 === 0 ? "#FFFFFF" : "#F5F1E8");
    doc.rect(TABLE_X, y, TABLE_W, rh).fill(bg);

  let x = TABLE_X;
    const hasNoMeal = !row.mainItem && row.extraMealItems.length === 0;
    COL_DEFS.forEach((col, colIdx) => {
      if (colIdx === 3) {
        if (hasNoMeal) {
          const ty = cellVCenter(doc, FONT_ITALIC, "bez jídla", col.width - 6, y, rh);
          doc.font(FONT_ITALIC).fontSize(FONT_BODY + 2).fillColor("#6B7280")
            .text("bez jídla", x + 3, ty, { width: col.width - 6, align: "center" });
        } else {
          drawMealCell(doc, row, x, y, col.width, rh);
        }
      } else if (colIdx === 2) {
        const soupGroups = consolidateSoups(row);
        if (soupGroups.length === 0) {
          doc.strokeColor("#CCCCCC").lineWidth(0.7)
            .moveTo(x + 3, y + 3).lineTo(x + col.width - 3, y + rh - 3).stroke();
        } else {
          const lineTexts = soupGroups.map(({ soup, count }) =>
            (count > 1 ? `${count}× ` : "") + (soup.code ? `${soup.code}  ${soup.name}` : soup.name)
          );
          const lineHeights = lineTexts.map(t => doc.font(FONT).fontSize(FONT_BODY).heightOfString(t, { width: col.width - 6 }));
          const totalH = lineHeights.reduce((s, h) => s + h, 0);
          let lineY = y + Math.max(0, (rh - totalH) / 2);
          soupGroups.forEach(({ soup, count }, si) => {
            let curX = x + 3;
            const avail = col.width - 6;
            if (count > 1) {
              const pfx = `${count}× `;
              doc.font(FONT_BOLD).fontSize(FONT_BODY + 1).fillColor(TABLE_HEADER_BG)
                .text(pfx, curX, lineY - 0.5, { lineBreak: false });
              curX += doc.font(FONT_BOLD).fontSize(FONT_BODY + 1).widthOfString(pfx);
            }
            if (soup.code) {
              doc.font(FONT_BOLD).fontSize(FONT_BODY).fillColor("#30343A")
                .text(soup.code, curX, lineY, { lineBreak: false });
              const codeW = doc.font(FONT_BOLD).fontSize(FONT_BODY).widthOfString(soup.code + "  ");
              curX += codeW;
              doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
                .text(soup.name, curX, lineY, { width: avail - (curX - (x + 3)), lineBreak: false });
            } else {
              doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
                .text(soup.name, curX, lineY, { width: avail - (curX - (x + 3)), lineBreak: false });
            }
            lineY += lineHeights[si];
          });
        }
      } else {
        const text = col.value(row, idx);
        const isNote = colIdx === 5 && !!text;
        const font = isNote ? FONT_BOLD : FONT;
        const ty = cellVCenter(doc, font, text, col.width - 6, y, rh);
        doc.font(font).fontSize(FONT_BODY).fillColor("#30343A")
          .text(text, x + 3, ty, { width: col.width - 6, align: col.align });
      }
      x += col.width;
    });
}

// Rámeček a linky se kreslí zvlášť pro každou část tabulky (tj. pro každou
// stránku), ne pro tabulku jako celek.
function drawTableGrid(doc: PDFKit.PDFDocument, headerY: number, rowHeights: number[]) {
  const totalH = HEADER_H + rowHeights.reduce((s, h) => s + h, 0);

  doc.strokeColor("#C0B8A8").lineWidth(0.5);
  doc.rect(TABLE_X, headerY, TABLE_W, totalH).stroke();

  let lineY = headerY + HEADER_H;
  for (const rh of rowHeights) {
    doc.moveTo(TABLE_X, lineY).lineTo(TABLE_X + TABLE_W, lineY).stroke();
    lineY += rh;
  }

  let lineX = TABLE_X;
  for (const col of COL_DEFS) {
    lineX += col.width;
    if (lineX < TABLE_X + TABLE_W) {
      doc.moveTo(lineX, headerY).lineTo(lineX, headerY + totalH).stroke();
    }
  }
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.font(FONT_BOLD).fontSize(11).fillColor("#B55233");
  doc.text(title, MARGIN, y, { lineBreak: false });
  return y + 15;
}

// Tabulka se stránkuje sama. Bez toho pdfkit u přetečení zakládá novou
// stránku pro každou buňku zvlášť (23 objednávek → 51 stran, 21.08.2026),
// zatímco pozadí a linky jdou na absolutní souřadnice a zůstanou na
// staré stránce.
function drawTable(
  doc: PDFKit.PDFDocument,
  rows: OrderRowEnriched[],
  startY: number,
  sectionTitle: string,
): number {
  const rowHeights = rows.map((row, idx) => calcRowHeight(doc, row, idx));

  let y = startY;
  let idx = 0;

  while (idx < rows.length) {
    const headerY = y;
    y = drawTableHeader(doc, y);

    const pageRowHeights: number[] = [];
    while (idx < rows.length) {
      const rh = rowHeights[idx];
      // Aspoň jeden řádek na stránku, jinak by se cyklus zacyklil na řádku
      // vyšším než stránka.
      if (pageRowHeights.length > 0 && y + rh > BOTTOM_LIMIT) break;
      drawTableRow(doc, rows[idx], idx, y, rh);
      y += rh;
      pageRowHeights.push(rh);
      idx += 1;
    }

    drawTableGrid(doc, headerY, pageRowHeights);

    if (idx < rows.length) {
      doc.addPage();
      y = drawSectionTitle(doc, `${sectionTitle} (pokračování)`, MARGIN);
    }
  }

  return y;
}

interface SummaryRow {
  personName: string;
  itemCode: string;
  itemName: string;
  count: string;
  details: string;
}

interface SummaryColDef {
  header: string;
  width: number;
  align: "left" | "center" | "right";
  value: (row: SummaryRow, idx: number) => string;
}

const SUMMARY_COL_DEFS: SummaryColDef[] = [
  { header: "#", width: 24, align: "center", value: (_, i) => String(i + 1) },
  { header: "Jméno", width: 130, align: "left", value: (r) => r.personName || "–" },
  { header: "Položka", width: 368, align: "left", value: (r) => r.itemCode ? `${r.itemCode}  ${r.itemName}` : r.itemName },
  { header: "Počet", width: 55, align: "center", value: (r) => r.count },
  { header: "Poznámka / přílohy", width: 208.89, align: "left", value: (r) => r.details },
];

function rowDetails(row: OrderRowEnriched): string {
  return [extraCell(row), row.note].filter(Boolean).join("\n");
}

function toSummaryRows(row: OrderRowEnriched): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const details = rowDetails(row);
  let detailsUsed = false;
  const add = (itemCode: string, itemName: string, count: number | string) => {
    rows.push({
      personName: row.personName || "–",
      itemCode,
      itemName,
      count: String(count),
      details: detailsUsed ? "" : details,
    });
    detailsUsed = true;
  };

  for (const { soup, count } of consolidateSoups(row)) {
    add(soup.code ? `Polévka ${soup.code}` : "", soup.code ? soup.name : `Polévka ${soup.name}`, count);
  }
  if (row.mainItem) add(row.mainItem.code ? String(row.mainItem.code) : "", row.mainItem.name, row.mealCount || 1);
  for (const { item, count } of row.extraMealItems) {
    add(item.code ? String(item.code) : "", item.name, count);
  }

  if (rows.length === 0 && details) {
    rows.push({
      personName: row.personName || "–",
      itemCode: "",
      itemName: "Přílohy / poznámka",
      count: "",
      details,
    });
  }

  return rows;
}

function calcSummaryRowHeight(doc: PDFKit.PDFDocument, row: SummaryRow, idx: number): number {
  doc.font(FONT).fontSize(FONT_BODY);
  let maxH = 0;
  SUMMARY_COL_DEFS.forEach((col, colIdx) => {
    let effectiveWidth = col.width - 6;
    if (colIdx === 2 && row.itemCode) {
      doc.font(FONT_BOLD).fontSize(FONT_BODY);
      effectiveWidth -= doc.widthOfString(row.itemCode + "  ");
      doc.font(FONT).fontSize(FONT_BODY);
    }
    const text = colIdx === 2 ? row.itemName : col.value(row, idx);
    const h = doc.heightOfString(text, { width: effectiveWidth });
    if (h > maxH) maxH = h;
  });
  return Math.max(maxH + ROW_PAD, 20);
}

function drawSummaryHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(TABLE_X, y, TABLE_W, HEADER_H).fill(TABLE_HEADER_BG);
  let x = TABLE_X;
  doc.font(FONT_BOLD).fontSize(FONT_HEADER).fillColor("#F5F1E8");
  for (const col of SUMMARY_COL_DEFS) {
    doc.text(col.header, x + 3, y + 7, { width: col.width - 6, align: col.align, lineBreak: false });
    x += col.width;
  }

  doc.strokeColor("#C0B8A8").lineWidth(0.5);
  doc.rect(TABLE_X, y, TABLE_W, HEADER_H).stroke();
  let lineX = TABLE_X;
  for (const col of SUMMARY_COL_DEFS) {
    lineX += col.width;
    if (lineX < TABLE_X + TABLE_W) {
      doc.moveTo(lineX, y).lineTo(lineX, y + HEADER_H).stroke();
    }
  }

  return y + HEADER_H;
}

function drawSummaryRow(doc: PDFKit.PDFDocument, row: SummaryRow, idx: number, y: number): number {
  const rh = calcSummaryRowHeight(doc, row, idx);
  const hasNote = !!row.details?.trim();
  const bg = hasNote ? "#FFFBEB" : (idx % 2 === 0 ? "#FFFFFF" : "#F5F1E8");
  doc.rect(TABLE_X, y, TABLE_W, rh).fill(bg);

  let x = TABLE_X;
  SUMMARY_COL_DEFS.forEach((col, colIdx) => {
    if (colIdx === 2 && row.itemCode) {
      doc.font(FONT_BOLD).fontSize(FONT_BODY).fillColor("#30343A")
        .text(row.itemCode, x + 3, y + 4, { lineBreak: false });
      const codeW = doc.widthOfString(row.itemCode + "  ");
      doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
        .text(row.itemName, x + 3 + codeW, y + 4, { width: col.width - 6 - codeW });
    } else {
      doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A")
        .text(col.value(row, idx), x + 3, y + 4, { width: col.width - 6, align: col.align });
    }
    x += col.width;
  });

  doc.strokeColor("#C0B8A8").lineWidth(0.5);
  doc.rect(TABLE_X, y, TABLE_W, rh).stroke();
  let lineX = TABLE_X;
  for (const col of SUMMARY_COL_DEFS) {
    lineX += col.width;
    if (lineX < TABLE_X + TABLE_W) {
      doc.moveTo(lineX, y).lineTo(lineX, y + rh).stroke();
    }
  }

  return y + rh;
}

function stampFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.font(FONT).fontSize(7.5).fillColor("#AAAAAA");
    doc.text(
      "Vygenerováno automaticky – automat objednávek STROS",
      MARGIN,
      PAGE_H - MARGIN - 10,
      { lineBreak: false },
    );
    if (range.count > 1) {
      doc.text(
        `Strana ${i + 1} / ${range.count}`,
        PAGE_W - MARGIN - 90,
        PAGE_H - MARGIN - 10,
        { width: 90, align: "right", lineBreak: false },
      );
    }
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed <= BOTTOM_LIMIT) return y;
  doc.addPage();
  return MARGIN;
}

function drawSummarySection(
  doc: PDFKit.PDFDocument,
  department: DepartmentData,
  startY: number
): number {
  const rows = getSubmittedRows(department.rows).flatMap(toSummaryRows);
  if (rows.length === 0) return startY;

  let y = ensureSpace(doc, startY, SECTION_MIN_H);
  y = drawSectionTitle(doc, department.emailLabel, y);
  y = drawSummaryHeader(doc, y);

  rows.forEach((row, idx) => {
    const rh = calcSummaryRowHeight(doc, row, idx);
    if (y + rh > BOTTOM_LIMIT) {
      doc.addPage();
      y = MARGIN;
      y = drawSectionTitle(doc, `${department.emailLabel} (pokračování)`, y);
      y = drawSummaryHeader(doc, y);
    }
    y = drawSummaryRow(doc, row, idx, y);
  });

  return y + 10;
}

export async function buildOrderPdfAttachment(
  orderData: OrderData
): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const activeDepartments = orderData.departments.filter((department) =>
    getSubmittedRows(department.rows).length > 0
  );

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Objednávka LIMA – ${formatDate(orderData.order.date)}`,
      Author: "STROS – automat objednávek",
    },
  });

  let y = MARGIN;

  doc.font(FONT_BOLD).fontSize(12).fillColor("#2F4858");
  doc.text("STROS – Sedlčanské strojírny, a.s.", MARGIN, y, { lineBreak: false });
  y += 15;

  doc.font(FONT_BOLD).fontSize(10).fillColor("#B55233");
  doc.text("Objednávka LIMA – souhrn", MARGIN, y, { lineBreak: false });
  doc.font(FONT).fontSize(9).fillColor("#888888");
  doc.text(formatDate(orderData.order.date), PAGE_W - MARGIN - 70, y, { lineBreak: false, width: 70, align: "right" });
  y += 13;

  doc.strokeColor("#D8C3A5").lineWidth(1)
    .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 8;

  if (activeDepartments.length === 0) {
    doc.font(FONT).fontSize(11).fillColor("#888").text("Žádné aktivní řádky.", MARGIN, y);
  } else {
    for (const department of activeDepartments) {
      const activeRows = getSubmittedRows(department.rows);
      y = ensureSpace(doc, y, SECTION_MIN_H);
      y = drawSectionTitle(doc, department.emailLabel, y);
      y = drawTable(doc, activeRows, y, department.emailLabel);
      y += 10;
    }
  }

  stampFooters(doc);

  const content = await pdfToBuffer(doc);
  return {
    filename: `Objednavka_LIMA_${orderData.order.date}.pdf`,
    content,
    contentType: "application/pdf",
  };
}

export async function buildDepartmentPdfAttachment(
  department: DepartmentData,
  orderDate: string
): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const activeRows = getSubmittedRows(department.rows);

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Objednávka LIMA – ${department.emailLabel}`,
      Author: "STROS – automat objednávek",
    },
  });

  let y = MARGIN;

  doc.font(FONT_BOLD).fontSize(12).fillColor("#2F4858");
  doc.text("STROS – Sedlčanské strojírny, a.s.", MARGIN, y, { lineBreak: false });
  y += 15;

  doc.font(FONT_BOLD).fontSize(10).fillColor("#B55233");
  doc.text(`Objednávka LIMA – ${department.emailLabel}`, MARGIN, y, { lineBreak: false });
  doc.font(FONT).fontSize(9).fillColor("#888888");
  doc.text(formatDate(orderDate), PAGE_W - MARGIN - 70, y, { lineBreak: false, width: 70, align: "right" });
  y += 13;

  doc.strokeColor("#D8C3A5").lineWidth(1)
    .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 7;

  if (activeRows.length === 0) {
    doc.font(FONT).fontSize(11).fillColor("#888").text("Žádné aktivní řádky.", MARGIN, y);
    y += 20;
  } else {
    y = drawTable(doc, activeRows, y, department.emailLabel);
  }

  stampFooters(doc);

  const content = await pdfToBuffer(doc);
  return {
    filename: `Objednavka_LIMA_${departmentFileSlug(department.name)}_${orderDate}.pdf`,
    content,
    contentType: "application/pdf",
  };
}
