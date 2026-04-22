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
  if (row.breadDumplingCount > 0) parts.push(`${row.breadDumplingCount}× HK`);
  if (row.potatoDumplingCount > 0) parts.push(`${row.potatoDumplingCount}× BK`);
  if (row.ketchupCount > 0) parts.push(`${row.ketchupCount}× Keč`);
  if (row.tatarkaCount > 0) parts.push(`${row.tatarkaCount}× Tat`);
  if (row.bbqCount > 0) parts.push(`${row.bbqCount}× BBQ`);
  return parts.join(", ");
}

interface ColDef {
  header: string;
  width: number;
  align: "left" | "center" | "right";
  value: (row: OrderRowEnriched, idx: number) => string;
}

const COL_DEFS: ColDef[] = [
  { header: "#", width: 24, align: "center", value: (_, i) => String(i + 1) },
  { header: "Jméno", width: 120, align: "left", value: (r) => r.personName || "–" },
  {
    header: "Polévka",
    width: 155,
    align: "left",
    value: (r) => r.soupItem ? `${r.soupItem.code}  ${r.soupItem.name}` : "–",
  },
  { header: "H", width: 18, align: "center", value: (r) => r.rollCount > 0 ? String(r.rollCount) : "" },
  {
    header: "Jídlo",
    width: 190,
    align: "left",
    value: (r) => r.mainItem ? `${r.mainItem.code}  ${r.mainItem.name}` : "–",
  },
  { header: "Přílohy", width: 110, align: "left", value: (r) => extraCell(r) },
  { header: "Cena", width: 48, align: "right", value: (r) => r.rowPrice > 0 ? `${r.rowPrice} Kč` : "–" },
];

// landscape A4: 841.89 x 595.28 pt
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 36;
const TABLE_X = MARGIN;
const TABLE_W = COL_DEFS.reduce((s, c) => s + c.width, 0);
const ROW_H = 22;
const HEADER_H = 26;
const FONT_BODY = 9;
const FONT_HEADER = 8.5;

function drawTable(doc: PDFKit.PDFDocument, rows: OrderRowEnriched[], startY: number): number {
  let y = startY;

  // header row bg
  doc.rect(TABLE_X, y, TABLE_W, HEADER_H).fill("#2F4858");

  // header text
  let x = TABLE_X;
  doc.font(FONT_BOLD).fontSize(FONT_HEADER).fillColor("#F5F1E8");
  for (const col of COL_DEFS) {
    doc.text(col.header, x + 3, y + 8, { width: col.width - 6, align: col.align, lineBreak: false });
    x += col.width;
  }

  y += HEADER_H;

  // data rows
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? "#FFFFFF" : "#F5F1E8";
    doc.rect(TABLE_X, y, TABLE_W, ROW_H).fill(bg);

    x = TABLE_X;
    doc.font(FONT).fontSize(FONT_BODY).fillColor("#30343A");
    for (const col of COL_DEFS) {
      const cell = col.value(row, idx);
      doc.text(cell, x + 3, y + 6, { width: col.width - 6, align: col.align, lineBreak: false });
      x += col.width;
    }
    y += ROW_H;
  });

  // grid lines
  doc.strokeColor("#C0B8A8").lineWidth(0.5);
  // outer border
  doc.rect(TABLE_X, startY, TABLE_W, HEADER_H + rows.length * ROW_H).stroke();
  // horizontal lines
  let lineY = startY + HEADER_H;
  for (let i = 0; i < rows.length; i++) {
    doc.moveTo(TABLE_X, lineY).lineTo(TABLE_X + TABLE_W, lineY).stroke();
    lineY += ROW_H;
  }
  // vertical lines
  let lineX = TABLE_X;
  for (const col of COL_DEFS) {
    lineX += col.width;
    if (lineX < TABLE_X + TABLE_W) {
      doc.moveTo(lineX, startY).lineTo(lineX, startY + HEADER_H + rows.length * ROW_H).stroke();
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

  // ── Company + department header ──────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16).fillColor("#2F4858");
  doc.text("Sedlčanské strojírny, a.s.", MARGIN, y, { lineBreak: false });
  y += 22;

  doc.font(FONT_BOLD).fontSize(13).fillColor("#B55233");
  doc.text(`Objednávka LIMA – ${DEPARTMENT_EMAIL_LABELS[department.name]}`, MARGIN, y, { lineBreak: false });
  y += 18;

  doc.font(FONT).fontSize(10).fillColor("#30343A");
  doc.text(`Datum: ${formatDate(orderDate)}`, MARGIN, y, { lineBreak: false });
  y += 18;

  // ── Separator line ────────────────────────────────────────────────────────
  doc.strokeColor("#D8C3A5").lineWidth(1.5)
    .moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke();
  y += 10;

  // ── Table ─────────────────────────────────────────────────────────────────
  if (activeRows.length === 0) {
    doc.font(FONT).fontSize(11).fillColor("#888").text("Žádné aktivní řádky.", MARGIN, y);
    y += 20;
  } else {
    y = drawTable(doc, activeRows, y);
  }

  // ── Subtotal ──────────────────────────────────────────────────────────────
  y += 10;
  doc.font(FONT_BOLD).fontSize(11).fillColor("#2F4858");
  doc.text(`Mezisoučet: ${department.subtotal} Kč`, MARGIN, y, { lineBreak: false });

  // ── Footer ────────────────────────────────────────────────────────────────
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
