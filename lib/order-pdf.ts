import PDFDocument from "pdfkit";
import path from "path";

const FONT = path.join("/usr/share/fonts/truetype/dejavu", "DejaVuSans.ttf");
const FONT_BOLD = path.join("/usr/share/fonts/truetype/dejavu", "DejaVuSans-Bold.ttf");
import { PassThrough } from "stream";
import { DEPARTMENT_EMAIL_LABELS, type DepartmentData, type OrderRowEnriched } from "./types";
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

function departmentFileSlug(name: DepartmentData["name"]): string {
  if (name === "Konstrukce") return "Konstrukce";
  if (name === "Dílna") return "Dilna";
  return "Obchod";
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
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
const MARGIN = 36;
const TABLE_X = MARGIN;
const TABLE_W = PAGE_W - 2 * MARGIN; // fill full width = 769.89

interface ColDef {
  header: string;
  width: number;
  align: "left" | "center" | "right";
  value: (row: OrderRowEnriched, idx: number) => string;
}

// widths sum to TABLE_W (769.89)
const COL_DEFS: ColDef[] = [
  { header: "#",        width: 22,     align: "center", value: (_, i) => String(i + 1) },
  { header: "Jméno",    width: 100,    align: "left",   value: (r) => r.personName || "–" },
  { header: "Polévka",  width: 120,    align: "left",   value: (r) => r.soupItem ? `${r.soupItem.code}  ${r.soupItem.name}` : "–" },
  { header: "Jídlo",    width: 185,    align: "left",   value: (r) => r.mainItem ? `${r.mainItem.code}  ${r.mainItem.name}` : "–" },
  { header: "Přílohy",  width: 120,    align: "left",   value: (r) => extraCell(r) },
  { header: "Poznámka", width: 222.89, align: "left",   value: (r) => r.note || "" },
];

const HEADER_H = 26;
const FONT_BODY = 9;
const FONT_HEADER = 8.5;
const ROW_PAD = 10; // top+bottom padding per cell

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

function drawTable(doc: PDFKit.PDFDocument, rows: OrderRowEnriched[], startY: number): number {
  // pre-calculate row heights
  const rowHeights = rows.map((row, idx) => calcRowHeight(doc, row, idx));
  const totalH = HEADER_H + rowHeights.reduce((s, h) => s + h, 0);

  let y = startY;

  // header bg
  doc.rect(TABLE_X, y, TABLE_W, HEADER_H).fill("#2F4858");
  let x = TABLE_X;
  doc.font(FONT_BOLD).fontSize(FONT_HEADER).fillColor("#F5F1E8");
  for (const col of COL_DEFS) {
    doc.text(col.header, x + 3, y + 8, { width: col.width - 6, align: col.align, lineBreak: false });
    x += col.width;
  }
  y += HEADER_H;

  // data rows
  rows.forEach((row, idx) => {
    const rh = rowHeights[idx];
    const bg = idx % 2 === 0 ? "#FFFFFF" : "#F5F1E8";
    doc.rect(TABLE_X, y, TABLE_W, rh).fill(bg);

    x = TABLE_X;
    doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A");
    for (const col of COL_DEFS) {
      const cell = col.value(row, idx);
      doc.text(cell, x + 3, y + 5, { width: col.width - 6, align: col.align });
      x += col.width;
    }
    y += rh;
  });

  // grid: outer border
  doc.strokeColor("#C0B8A8").lineWidth(0.5);
  doc.rect(TABLE_X, startY, TABLE_W, totalH).stroke();

  // horizontal lines
  let lineY = startY + HEADER_H;
  for (const rh of rowHeights) {
    doc.moveTo(TABLE_X, lineY).lineTo(TABLE_X + TABLE_W, lineY).stroke();
    lineY += rh;
  }

  // vertical lines
  let lineX = TABLE_X;
  for (const col of COL_DEFS) {
    lineX += col.width;
    if (lineX < TABLE_X + TABLE_W) {
      doc.moveTo(lineX, startY).lineTo(lineX, startY + totalH).stroke();
    }
  }

  return y;
}

export async function buildDepartmentPdfAttachment(
  department: DepartmentData,
  orderDate: string
): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const activeRows = getSubmittedRows(department.rows);

  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margin: MARGIN,
    info: {
      Title: `Objednávka LIMA – ${DEPARTMENT_EMAIL_LABELS[department.name]}`,
      Author: "STROS – automat objednávek",
    },
  });

  let y = MARGIN;

  doc.font(FONT_BOLD).fontSize(16).fillColor("#2F4858");
  doc.text("STROS – Sedlčanské strojírny, a.s.", MARGIN, y, { lineBreak: false });
  y += 22;

  doc.font(FONT_BOLD).fontSize(13).fillColor("#B55233");
  doc.text(`Objednávka LIMA – ${DEPARTMENT_EMAIL_LABELS[department.name]}`, MARGIN, y, { lineBreak: false });
  y += 18;

  doc.font(FONT).fontSize(10).fillColor("#30343A");
  doc.text(`Datum: ${formatDate(orderDate)}`, MARGIN, y, { lineBreak: false });
  y += 18;

  doc.strokeColor("#D8C3A5").lineWidth(1.5)
    .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 10;

  if (activeRows.length === 0) {
    doc.font(FONT).fontSize(11).fillColor("#888").text("Žádné aktivní řádky.", MARGIN, y);
    y += 20;
  } else {
    y = drawTable(doc, activeRows, y);
  }

  doc.font(FONT).fontSize(8).fillColor("#888");
  doc.text(
    `Vygenerováno automaticky – automat objednávek STROS`,
    MARGIN,
    PAGE_H - MARGIN - 10,
    { lineBreak: false }
  );

  const content = await pdfToBuffer(doc);
  return {
    filename: `Objednavka_LIMA_${departmentFileSlug(department.name)}_${orderDate}.pdf`,
    content,
    contentType: "application/pdf",
  };
}
