import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { saveGlobalSettings } from "./global-settings";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const RETENTION_DAYS = 30;

export async function runNightlyBackup(): Promise<void> {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const date = new Date().toISOString().split("T")[0];
  const dbFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".db"));
  if (dbFiles.length === 0) return;

  const backupPaths: string[] = [];

  for (const dbFile of dbFiles) {
    const src = path.join(DATA_DIR, dbFile);
    const slug = dbFile.slice(0, -3);
    const dest = path.join(BACKUPS_DIR, `${slug}_${date}.db`);

    // VACUUM INTO = atomický hot backup (cp za běhu = corrupted backup risk)
    const db = new Database(src, { readonly: true });
    try {
      db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
      backupPaths.push(dest);
    } finally {
      db.close();
    }
  }

  // Pure-Node tar.gz (bez shell spawnu — žádné injection risk, žádná závislost na tar binárce)
  const archivePath = path.join(BACKUPS_DIR, `kantyna_${date}.tar.gz`);
  await createTarGz(archivePath, backupPaths);

  // Smazat per-DB zálohy — zachovat jen archiv
  for (const f of backupPaths) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }

  // Retention: smazat archivy starší než RETENTION_DAYS
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(BACKUPS_DIR)) {
    if (!f.startsWith("kantyna_") || !f.endsWith(".tar.gz")) continue;
    const full = path.join(BACKUPS_DIR, f);
    try {
      const { mtimeMs } = fs.statSync(full);
      if (mtimeMs < cutoff) fs.unlinkSync(full);
    } catch { /* ignore */ }
  }

  saveGlobalSettings({ lastBackupAt: new Date().toISOString() });
  console.log(`[backup] Záloha ${date} dokončena (${dbFiles.length} souborů → ${archivePath})`);
}

// Pure-Node tar.gz bez shellu (ustar formát)
async function createTarGz(archivePath: string, filePaths: string[]): Promise<void> {
  const { createGzip } = await import("node:zlib");
  const { pipeline } = await import("node:stream/promises");
  const { PassThrough } = await import("node:stream");

  const out = fs.createWriteStream(archivePath);
  const gz = createGzip({ level: 6 });
  const tarStream = new PassThrough();
  const writeP = pipeline(tarStream, gz, out);

  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    const data = fs.readFileSync(filePath);
    const size = data.length;

    const header = Buffer.alloc(512);
    Buffer.from(name.slice(0, 100)).copy(header, 0);
    header.write("0000755\0", 100, "ascii");
    header.write("0000000\0", 108, "ascii");
    header.write("0000000\0", 116, "ascii");
    header.write(size.toString(8).padStart(11, "0") + "\0", 124, "ascii");
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0", 136, "ascii");
    header.write("        ", 148, "ascii");
    header.write("0", 156, "ascii");
    header.write("ustar\0", 257, "ascii");
    header.write("00", 263, "ascii");

    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");

    tarStream.push(header);
    tarStream.push(data);
    const remainder = size % 512;
    if (remainder) tarStream.push(Buffer.alloc(512 - remainder));
  }

  tarStream.push(Buffer.alloc(1024));
  tarStream.end();
  await writeP;
}
