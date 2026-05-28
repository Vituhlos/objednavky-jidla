import { ImapFlow } from "imapflow";
import path from "path";
import fs from "fs";
import { resolve4 } from "dns/promises";
import { getSettings } from "./settings";
import { parseMenuText } from "./parse-menu";
import { setMenuForWeek } from "./menu";
import { logAudit } from "./audit";
import { extractStructuredText } from "./pdf-extract";

export interface ImapCheckResult {
  found: boolean;
  weekLabel?: string;
  weekStart?: string;
  itemCount?: number;
  error?: string;
}

interface BodyNode {
  type?: string;
  disposition?: string;
  dispositionParameters?: { filename?: string };
  parameters?: { name?: string };
  part?: string;
  childNodes?: BodyNode[];
}

function findPdfPart(node: BodyNode | null | undefined): BodyNode | null {
  if (!node) return null;
  const filename =
    node.dispositionParameters?.filename ??
    node.parameters?.name ??
    "";
  if (
    node.type === "application/pdf" ||
    (node.disposition === "attachment" && filename.toLowerCase().endsWith(".pdf")) ||
    filename.toLowerCase().endsWith(".pdf")
  ) {
    return node;
  }
  if (node.childNodes) {
    for (const child of node.childNodes) {
      const found = findPdfPart(child);
      if (found) return found;
    }
  }
  return null;
}

export async function checkImapForMenu(): Promise<ImapCheckResult> {
  const s = getSettings();

  if (s.imapEnabled !== "true") return { found: false, error: "IMAP není zapnuto." };
  if (!s.imapHost || !s.imapUser || !s.imapPass) return { found: false, error: "IMAP přihlašovací údaje nejsou nastaveny." };

  // Vynutíme IPv4 — imapflow jinak zkouší IPv6 první, které na Unraidu nefunguje
  let resolvedHost = s.imapHost;
  try {
    const [ipv4] = await resolve4(s.imapHost);
    resolvedHost = ipv4;
    console.log(`[imap] Připojuji na ${ipv4} (${s.imapHost})`);
  } catch (e) {
    console.warn(`[imap] DNS resolve4 selhalo: ${e instanceof Error ? e.message : e}`);
  }

  const client = new ImapFlow({
    host: resolvedHost,
    port: parseInt(s.imapPort) || 993,
    secure: true,
    auth: { user: s.imapUser, pass: s.imapPass },
    logger: false,
    tls: { servername: s.imapHost },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 60000,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchQuery: Record<string, unknown> = { seen: false };
      if (s.imapSender) searchQuery.from = s.imapSender;

      const uids = (await client.search(
        searchQuery as Parameters<typeof client.search>[0],
        { uid: true }
      )) as number[] | false;

      const uidList = uids || [];
      console.log(`[imap] Nalezeno ${uidList.length} nepřečtených mailů.`);

      if (uidList.length === 0) return { found: false };

      // Projdeme maily a hledáme PDF přílohu
      for (const uid of uidList) {
        const msgInfo = await client.fetchOne(
          String(uid),
          { uid: true, envelope: true, bodyStructure: true },
          { uid: true }
        );
        if (!msgInfo || !msgInfo.bodyStructure) continue;

        const subject = (msgInfo as { envelope?: { subject?: string } }).envelope?.subject ?? "(bez předmětu)";
        console.log(`[imap] Kontroluji mail UID ${uid}: ${subject}`);

        const pdfPart = findPdfPart(msgInfo.bodyStructure as unknown as BodyNode);
        if (!pdfPart) {
          console.log(`[imap] Mail UID ${uid} neobsahuje PDF přílohu, přeskakuji.`);
          continue;
        }

        console.log(`[imap] PDF nalezeno (part: ${pdfPart.part ?? "1"}), stahuji...`);
        const { content } = await client.download(String(uid), pdfPart.part ?? "1", { uid: true });
        const chunks: Buffer[] = [];
        for await (const chunk of content) chunks.push(chunk);
        const pdfBuffer = Buffer.concat(chunks);
        console.log(`[imap] PDF staženo (${pdfBuffer.length} B), parsuju...`);

        const rawText = await extractStructuredText(new Uint8Array(pdfBuffer));
        const parsed = parseMenuText(rawText);
        console.log(`[imap] PDF text preview: ${rawText.slice(0, 300).replace(/\n/g, " | ")}`);

        if (parsed.items.length === 0 || !parsed.weekStart || !parsed.weekLabel) {
          console.log(`[imap] PDF z mailu UID ${uid} není jídelníček (items: ${parsed.items.length}, weekStart: ${parsed.weekStart}), přeskakuji.`);
          continue;
        }

        // Uložíme menu a PDF
        setMenuForWeek(parsed.weekStart, parsed.weekLabel, parsed.items);
        try {
          const pdfsDir = path.join(process.cwd(), "data", "pdfs");
          fs.mkdirSync(pdfsDir, { recursive: true });
          fs.writeFileSync(path.join(pdfsDir, `${parsed.weekStart}.pdf`), pdfBuffer);
        } catch { /* non-fatal */ }

        // Označíme jako přečtený
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });

        logAudit({ action: "menu_imap_import", details: `Import z e-mailu: ${parsed.weekLabel} (${parsed.items.length} položek)` });
        console.log(`[imap] Importován jídelníček ${parsed.weekLabel} (${parsed.items.length} položek).`);

        return { found: true, weekLabel: parsed.weekLabel, weekStart: parsed.weekStart, itemCount: parsed.items.length };
      }

      return { found: false };

    } finally {
      lock.release();
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[imap] Chyba:", msg);
    return { found: false, error: msg };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
