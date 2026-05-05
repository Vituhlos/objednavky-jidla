import { ImapFlow } from "imapflow";
import pdfParse from "pdf-parse";
import path from "path";
import fs from "fs";
import { getSettings } from "./settings";
import { parseMenuText } from "./parse-menu";
import { setMenuForWeek } from "./menu";
import { logAudit } from "./audit";

export interface ImapCheckResult {
  found: boolean;
  weekLabel?: string;
  weekStart?: string;
  itemCount?: number;
  error?: string;
}

export async function checkImapForMenu(): Promise<ImapCheckResult> {
  const s = getSettings();

  if (s.imapEnabled !== "true") return { found: false, error: "IMAP není zapnuto." };
  if (!s.imapHost || !s.imapUser || !s.imapPass) return { found: false, error: "IMAP přihlašovací údaje nejsou nastaveny." };

  const client = new ImapFlow({
    host: s.imapHost,
    port: parseInt(s.imapPort) || 993,
    secure: true,
    auth: { user: s.imapUser, pass: s.imapPass },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Hledáme nepřečtené maily s PDF přílohou
    const searchCriteria: Record<string, unknown> = { seen: false };
    if (s.imapSender) searchCriteria.from = s.imapSender;

    const messages = client.fetch(searchCriteria, { uid: true, envelope: true, bodyStructure: true });

    let pdfBuffer: Buffer | null = null;
    let processedUid: number | null = null;

    for await (const msg of messages) {
      if (!msg.bodyStructure) continue;
      const parts = flattenParts(msg.bodyStructure as unknown as Record<string, unknown>);
      const pdfPart = parts.find(
        (p) => p.type === "application" && (p.subtype === "pdf" || p.subtype === "octet-stream")
          || (p.disposition === "attachment" && p.dispositionParameters?.filename?.toLowerCase().endsWith(".pdf"))
      );
      if (!pdfPart) continue;

      const partData = await client.download(String(msg.uid), pdfPart.part ?? "1", { uid: true });
      const chunks: Buffer[] = [];
      for await (const chunk of partData.content) chunks.push(chunk);
      pdfBuffer = Buffer.concat(chunks);
      processedUid = msg.uid;
      break;
    }

    if (!pdfBuffer || processedUid === null) {
      await client.logout();
      return { found: false };
    }

    // Parsujeme PDF
    const rawResult = await pdfParse(pdfBuffer);
    const parsed = parseMenuText(rawResult.text);

    if (parsed.items.length === 0 || !parsed.weekStart || !parsed.weekLabel) {
      await client.logout();
      return { found: false, error: "PDF bylo nalezeno, ale nepodařilo se z něj načíst jídelníček." };
    }

    // Uložíme menu
    setMenuForWeek(parsed.weekStart, parsed.weekLabel, parsed.items);

    // Uložíme PDF
    try {
      const pdfsDir = path.join(process.cwd(), "data", "pdfs");
      fs.mkdirSync(pdfsDir, { recursive: true });
      fs.writeFileSync(path.join(pdfsDir, `${parsed.weekStart}.pdf`), pdfBuffer);
    } catch { /* non-fatal */ }

    // Označíme mail jako přečtený
    await client.messageFlagsAdd({ uid: processedUid }, ["\\Seen"], { uid: true });

    logAudit({ action: "menu_imap_import", details: `Automatický import z e-mailu: ${parsed.weekLabel} (${parsed.items.length} položek)` });
    console.log(`[imap] Importován jídelníček ${parsed.weekLabel} z e-mailu (${parsed.items.length} položek).`);

    await client.logout();
    return { found: true, weekLabel: parsed.weekLabel, weekStart: parsed.weekStart, itemCount: parsed.items.length };

  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[imap] Chyba:", msg);
    return { found: false, error: msg };
  }
}

interface BodyPart {
  type: string;
  subtype: string;
  part?: string;
  disposition?: string;
  dispositionParameters?: { filename?: string };
}

function flattenParts(structure: Record<string, unknown>, prefix = ""): BodyPart[] {
  if (!structure) return [];
  const results: BodyPart[] = [];

  if (Array.isArray(structure.childNodes)) {
    (structure.childNodes as Record<string, unknown>[]).forEach((child, i) => {
      const partId = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      results.push(...flattenParts(child, partId));
    });
  } else {
    results.push({
      type: String(structure.type ?? ""),
      subtype: String(structure.subtype ?? ""),
      part: prefix || "1",
      disposition: structure.disposition as string | undefined,
      dispositionParameters: structure.dispositionParameters as { filename?: string } | undefined,
    });
  }
  return results;
}
