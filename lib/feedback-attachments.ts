import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getDataDir, getDb } from "./db";
import { FEEDBACK_ATTACHMENT_LIMITS, type FeedbackAttachment } from "./feedback-meta";

/**
 * Screenshoty k připomínkám.
 *
 * Nahrává je kdokoli bez přihlášení, proto se s nimi zachází jako s nedůvěryhodnými:
 * - obsah se nečte podle přípony ani Content-Type, ale dekóduje ho `sharp` —
 *   co není skutečný obrázek, neprojde;
 * - každý obrázek se znovu zakóduje do WebP. Tím zmizí EXIF (poloha, model
 *   telefonu), vložené profily i cokoli „přilepeného“ za obrazová data;
 * - rozměry i počet pixelů jsou omezené (obrana proti dekompresním bombám);
 * - na disku je strop pro všechny přílohy dohromady;
 * - soubory se jmenují náhodným UUID, jméno od uživatele se nikde nepoužije.
 */

const OUTPUT_MIME = "image/webp";
const MAX_INPUT_PIXELS = 40_000_000;

export class AttachmentError extends Error {}

export function getAttachmentDir(): string {
  return path.join(getDataDir(), "feedback-attachments");
}

export type ProcessedImage = { buffer: Buffer; width: number; height: number };

/** Dekóduje, srovná podle EXIF orientace, zmenší a uloží jako WebP bez metadat. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > FEEDBACK_ATTACHMENT_LIMITS.maxInputBytes) {
    throw new AttachmentError("Obrázek je příliš velký.");
  }
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false });
    const meta = await image.metadata();
    if (!meta.format || !["png", "jpeg", "webp", "gif"].includes(meta.format)) {
      throw new AttachmentError("Tenhle formát obrázku neumíme.");
    }
    const { data, info } = await image
      .rotate()
      .resize({
        width: FEEDBACK_ATTACHMENT_LIMITS.maxDimension,
        height: FEEDBACK_ATTACHMENT_LIMITS.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof AttachmentError) throw err;
    throw new AttachmentError("Soubor se nepodařilo načíst jako obrázek.");
  }
}

function getStoredBytes(): number {
  const { total } = getDb()
    .prepare("SELECT COALESCE(SUM(size), 0) AS total FROM feedback_attachments")
    .get() as { total: number };
  return total;
}

/**
 * Zapíše už zpracované obrázky k připomínce. Volá se uvnitř transakce, která
 * připomínku zakládá — když cokoli selže, soubory se uklidí a výjimka letí dál.
 */
export function storeAttachments(feedbackId: number, images: ProcessedImage[]): void {
  if (images.length === 0) return;
  const incoming = images.reduce((sum, img) => sum + img.buffer.length, 0);
  if (getStoredBytes() + incoming > FEEDBACK_ATTACHMENT_LIMITS.maxStoredBytes) {
    throw new AttachmentError("Na obrázky už teď nezbývá místo. Pošli připomínku bez nich.");
  }

  const dir = getAttachmentDir();
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  try {
    const insert = getDb().prepare(
      "INSERT INTO feedback_attachments (feedback_id, file_name, mime, size, width, height) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const img of images) {
      const fileName = `${randomUUID()}.webp`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, img.buffer, { flag: "wx" });
      written.push(filePath);
      insert.run(feedbackId, fileName, OUTPUT_MIME, img.buffer.length, img.width, img.height);
    }
  } catch (err) {
    for (const file of written) fs.rmSync(file, { force: true });
    throw err;
  }
}

type Row = { id: number; feedback_id: number; file_name: string; mime: string; size: number; width: number; height: number };

export function getAttachmentsByFeedback(): Map<number, FeedbackAttachment[]> {
  const rows = getDb()
    .prepare("SELECT id, feedback_id, file_name, mime, size, width, height FROM feedback_attachments ORDER BY id")
    .all() as Row[];
  const map = new Map<number, FeedbackAttachment[]>();
  for (const r of rows) {
    const list = map.get(r.feedback_id) ?? [];
    list.push({ id: r.id, width: r.width, height: r.height, size: r.size });
    map.set(r.feedback_id, list);
  }
  return map;
}

/** Cesta k souboru přílohy, nebo null. Jméno pochází z DB, ale i tak se ověří, že nevede ven. */
export function getAttachmentFile(id: number): { filePath: string; mime: string; size: number } | null {
  const row = getDb()
    .prepare("SELECT file_name, mime, size FROM feedback_attachments WHERE id = ?")
    .get(id) as { file_name: string; mime: string; size: number } | undefined;
  if (!row || !/^[0-9a-f-]{36}\.webp$/.test(row.file_name)) return null;
  const filePath = path.join(getAttachmentDir(), row.file_name);
  if (!fs.existsSync(filePath)) return null;
  return { filePath, mime: row.mime, size: row.size };
}

/** Smaže soubory příloh připomínky. Řádky v DB zmizí s připomínkou přes CASCADE. */
export function deleteAttachmentFiles(feedbackId: number): void {
  const rows = getDb()
    .prepare("SELECT file_name FROM feedback_attachments WHERE feedback_id = ?")
    .all(feedbackId) as { file_name: string }[];
  for (const r of rows) {
    if (!/^[0-9a-f-]{36}\.webp$/.test(r.file_name)) continue;
    fs.rmSync(path.join(getAttachmentDir(), r.file_name), { force: true });
  }
}
