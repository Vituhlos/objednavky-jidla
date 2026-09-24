import { getCategoryMeta, getStatusMeta, type FeedbackEntry } from "./feedback-meta";

/**
 * Předání připomínky dál — do AI asistenta (schránka) nebo jako úkol na GitHub.
 *
 * Jméno autora se nepředává nikam: AI ho k opravě nepotřebuje a repozitář je
 * veřejný. Interní poznámka jde jen do schránky, na GitHub ne.
 */

export const GITHUB_REPO_URL = "https://github.com/Vituhlos/objednavky-jidla";

// Prohlížeče i GitHub zvládají delší adresy, ale kolem 8 000 znaků už
// některé proxy odmítají požadavek. Text připomínky se pak zkrátí.
const MAX_ISSUE_URL_LENGTH = 7500;

type ExportableFeedback = Pick<
  FeedbackEntry,
  "id" | "createdAt" | "category" | "message" | "page" | "device" | "status" | "adminNote" | "context" | "appVersion" | "attachments"
>;

function detailLines(entry: ExportableFeedback): string[] {
  const cat = getCategoryMeta(entry.category);
  return [
    `- Kategorie: ${cat.emoji} ${cat.label}`,
    `- Stav: ${getStatusMeta(entry.status).label}`,
    `- Odesláno: ${entry.createdAt} (UTC)`,
    `- Stránka: ${entry.page || "neznámá"}`,
    `- Zařízení: ${entry.device || "neznámé"}`,
    `- Verze aplikace: ${entry.appVersion ? `v${entry.appVersion}` : "neznámá"}`,
    ...(entry.context ? [`- Technický údaj: \`${entry.context.replace(/`/g, "'")}\``] : []),
    ...(entry.attachments.length > 0 ? [`- Screenshoty: ${entry.attachments.length} (v Nastavení → Připomínky, přiložit ručně)`] : []),
  ];
}

/** Hotové zadání pro Claude Code nebo Codex — vloží se do chatu tak, jak je. */
export function buildAiPrompt(entry: ExportableFeedback): string {
  const lines = [
    `Připomínka #${entry.id} z aplikace Kantýna (stránka Připomínky).`,
    "",
    ...detailLines(entry),
    "",
    "Text od uživatele:",
    quote(entry.message),
  ];
  if (entry.adminNote.trim()) {
    lines.push("", "Moje poznámka:", quote(entry.adminNote));
  }
  lines.push(
    "",
    "Úkol: najdi příčinu v kódu a navrhni řešení. Pokud je jasné a malé, rovnou ho udělej v nové větvi z main.",
    "Drž se AGENTS.md a CLAUDE.md (SemVer, CHANGELOG.md, lib/release-notes.ts, Conventional Commits) a nerozbij objednávky, PDF ani e-mail.",
    "Nejasné nebo velké věci se mě nejdřív zeptej.",
  );
  return lines.join("\n");
}

/** Odkaz na předvyplněný nový úkol. GitHub formulář ještě ukáže k úpravě, nic se neodesílá samo. */
export function buildGithubIssueUrl(entry: ExportableFeedback): string {
  const cat = getCategoryMeta(entry.category);
  const firstLine = entry.message.trim().split("\n")[0];
  const title = `${cat.emoji} ${cat.short}: ${firstLine.length > 70 ? `${firstLine.slice(0, 69)}…` : firstLine}`;

  const build = (message: string) => {
    const body = [
      `Připomínka #${entry.id} z aplikace (bez jména autora).`,
      "",
      ...detailLines(entry),
      "",
      "### Text",
      quote(message),
    ].join("\n");
    return `${GITHUB_REPO_URL}/issues/new?${new URLSearchParams({ title, body }).toString()}`;
  };

  let url = build(entry.message);
  if (url.length <= MAX_ISSUE_URL_LENGTH) return url;
  // Zkracuje se jen text připomínky, údaje nad ním zůstanou celé.
  let length = entry.message.length;
  while (url.length > MAX_ISSUE_URL_LENGTH && length > 0) {
    length = Math.floor(length * 0.8);
    url = build(`${entry.message.slice(0, length)}… (zkráceno, celý text je v Nastavení)`);
  }
  return url;
}

function quote(text: string): string {
  return text.trim().split("\n").map((line) => `> ${line}`).join("\n");
}
