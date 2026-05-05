import { ImapFlow } from "imapflow";
import pdfParse from "pdf-parse";
import path from "path";
import fs from "fs";
import { resolve4 } from "dns/promises";
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

  // Vynutíme IPv4 — imapflow jinak zkouší IPv6 první, které na Unraidu nefunguje
  let resolvedHost = s.imapHost;
  try {
    const [ipv4] = await resolve4(s.imapHost);
    resolvedHost = ipv4;
    console.log(`[imap] Připojuji na ${ipv4} (${s.imapHost})`);
  } catch (e) {
    console.warn(`[imap] DNS resolve4 selhalo, zkouším hostname přímo: ${e instanceof Error ? e.message : e}`);
  }

  const client = new ImapFlow({
    host: resolvedHost,
    port: parseInt(s.imapPort) || 993,
    secure: true,
    auth: { user: s.imapUser, pass: s.imapPass },
    logger: { debug: () => {}, info: (obj: Record<string,unknown>) => console.log("[imap]", obj.msg), warn: (obj: Record<string,unknown>) => console.warn("[imap]", obj.msg), error: (obj: Record<string,unknown>) => console.error("[imap]", obj.msg) },
    tls: { servername: s.imapHost },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 60000,
  });

  // Zachytíme error eventy které imapflow emituje mimo try/catch (např. socket timeout)
  let earlyError: Error | null = null;
  client.on("error", (err: Error) => { earlyError = err; });

  try {
    await client.connect();
    if (earlyError) throw earlyError;
    await client.mailboxOpen("INBOX");

    // Najdeme nepřečtené maily — search() vrátí UIDs, fetch() pak stáhne detaily
    const searchQuery: Record<string, unknown> = { seen: false };
    if (s.imapSender) searchQuery.from = s.imapSender;

    const uids = (await client.search(searchQuery as Parameters<typeof client.search>[0], { uid: true })) || [];
    console.log(`[imap] Nalezeno ${uids.length} nepřečtených mailů.`);

    if (uids.length === 0) {
      await client.logout();
      return { found: false };
    }

    // Stáhneme bodyStructure prvního mailu
    const firstUid = (uids as number[])[0];
    console.log(`[imap] Stahuji strukturu mailu UID ${firstUid}...`);
    const msgInfo = await client.fetchOne(String(firstUid), { uid: true, envelope: true, bodyStructure: true }, { uid: true });
    if (!msgInfo) { await client.logout(); return { found: false, error: "Mail nenalezen." }; }
    console.log(`[imap] Struktura stažena, subject: ${msgInfo.envelope?.subject ?? "(bez předmětu)"}`);

    if (!msgInfo.bodyStructure) {
      await client.logout();
      return { found: false, error: "Mail neobsahuje žádnou strukturu těla." };
    }

    const parts = flattenParts(msgInfo.bodyStructure! as unknown as Record<string, unknown>);
    console.log(`[imap] Části mailu: ${parts.map(p => `${p.type}/${p.subtype}(${p.disposition ?? "-"})`).join(", ")}`);

    const pdfPart = parts.find(
      (p) => (p.type === "application" && (p.subtype === "pdf" || p.subtype === "octet-stream"))
        || (p.disposition === "attachment" && p.dispositionParameters?.filename?.toLowerCase().endsWith(".pdf"))
    );

    if (!pdfPart) {
      await client.logout();
      return { found: false, error: "Mail byl nalezen, ale neobsahuje PDF přílohu." };
    }

    console.log(`[imap] PDF příloha nalezena (part: ${pdfPart.part}), stahuji...`);
    const partData = await client.download(String(firstUid), pdfPart.part ?? "1", { uid: true });
    const chunks: Buffer[] = [];
    for await (const chunk of partData.content) chunks.push(chunk);
    const pdfBuffer = Buffer.concat(chunks);
    const processedUid = firstUid;
    console.log(`[imap] PDF staženo (${pdfBuffer.length} B).`);

    if (!pdfBuffer.length) {
      await client.logout();
      return { found: false, error: "PDF příloha je prázdná." };
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
    // earlyError je původní příčina — "Connection not available" ji jinak přepíše
    const rootErr = earlyError ?? err;
    const msg = rootErr instanceof Error ? rootErr.message : String(rootErr);
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
