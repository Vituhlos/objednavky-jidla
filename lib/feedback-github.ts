import { getDb } from "./db";
import { GITHUB_REPO, parseFeedbackIssueMarker } from "./feedback-export";

/**
 * Spárování připomínek s úkoly na GitHubu.
 *
 * Úkol zakládá správce sám přes odkaz z Nastavení; appka k tomu žádné údaje
 * nemá. Potom si jen přečte seznam posledních úkolů (repozitář je veřejný,
 * takže bez tokenu) a podle značky v textu k připomínce zapíše číslo a stav.
 *
 * Text úkolu může napsat kdokoli s účtem na GitHubu, proto se berou jen úkoly
 * od vlastníka nebo spolupracovníků repozitáře, a z odpovědi se ukládá jen
 * číslo a stav — nic, co by se pak vykreslovalo jako odkaz nebo HTML.
 *
 * Kdyby byl repozitář soukromý, stačí nastavit env `GITHUB_TOKEN` (jen čtení
 * issues). Záměrně env, ne nastavení v DB: do zálohy se tak nedostane.
 */

const TRUSTED_AUTHORS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
// Bez tokenu dovolí GitHub 60 požadavků za hodinu na IP. Nejvýš jednou za
// 90 s = 40 za hodinu, s rezervou pro cokoli dalšího na stejné adrese.
const MIN_INTERVAL_MS = 90_000;
// Když správce právě zakládá úkol, ptát se častěji — klient to posílá jen
// 10 minut po kliknutí na „Založit úkol“, takže je to nejvýš ~20 dotazů navíc.
const EAGER_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 5_000;

type GithubIssue = {
  number: number;
  state: string;
  body?: string | null;
  author_association?: string;
  pull_request?: unknown;
};

export type IssueLink = { feedbackId: number; issue: number; state: "open" | "closed" };

/** Z odpovědi GitHubu vybere úkoly se značkou od důvěryhodných autorů. Bez DB, kvůli testům. */
export function extractIssueLinks(issues: unknown): { issue: number; state: "open" | "closed"; id: number; createdAt: string }[] {
  if (!Array.isArray(issues)) return [];
  const links: { issue: number; state: "open" | "closed"; id: number; createdAt: string }[] = [];
  for (const raw of issues as GithubIssue[]) {
    if (!raw || typeof raw !== "object" || raw.pull_request) continue;
    if (!Number.isInteger(raw.number) || raw.number <= 0) continue;
    if (!TRUSTED_AUTHORS.has(String(raw.author_association))) continue;
    const marker = parseFeedbackIssueMarker(typeof raw.body === "string" ? raw.body : "");
    if (!marker) continue;
    links.push({ issue: raw.number, state: raw.state === "closed" ? "closed" : "open", ...marker });
  }
  // GitHub vrací nejnovější první; u dvou úkolů k jedné připomínce vyhraje ten starší.
  return links.reverse();
}

let lastSync = 0;
// Když GitHub ohlásí vyčerpaný limit, neptat se až do jeho obnovení.
let blockedUntil = 0;
let running: Promise<number> | null = null;

/**
 * Stáhne posledních 100 úkolů a zapíše k připomínkám čísla a stavy.
 * Vrací počet změněných připomínek. Chyby sítě nebo limitu GitHubu tiše
 * spolkne — jde jen o pohodlí, Nastavení kvůli tomu nesmí spadnout.
 */
export function syncFeedbackIssues({ eager = false, now = Date.now() }: { eager?: boolean; now?: number } = {}): Promise<number> {
  if (running) return running;
  if (now - lastSync < (eager ? EAGER_INTERVAL_MS : MIN_INTERVAL_MS) || now < blockedUntil) return Promise.resolve(0);
  lastSync = now;
  running = fetchIssues()
    .then((issues) => applyIssueLinks(extractIssueLinks(issues)))
    .catch((err) => {
      console.warn("[feedback] Úkoly z GitHubu se nepodařilo načíst:", err instanceof Error ? err.message : err);
      return 0;
    })
    .finally(() => { running = null; });
  return running;
}

async function fetchIssues(): Promise<unknown> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=all&sort=created&direction=desc&per_page=100`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kantyna-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  const request = (auth: boolean) => fetch(url, {
    headers: auth ? { ...headers, Authorization: `Bearer ${token}` } : headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  let res = await request(Boolean(token));
  // Prošlý nebo neplatný token by u veřejného repozitáře zbytečně všechno
  // zastavil — zkusit to ještě bez něj.
  if (token && res.status === 401) res = await request(false);
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    blockedUntil = Number.isFinite(reset) && reset > Date.now() ? Math.min(reset, Date.now() + 3_600_000) : Date.now() + 3_600_000;
  }
  if (!res.ok) throw new Error(`GitHub odpověděl ${res.status}`);
  return res.json();
}

export function applyIssueLinks(links: { issue: number; state: "open" | "closed"; id: number; createdAt: string }[]): number {
  const db = getDb();
  const update = db.prepare(
    `UPDATE feedback SET github_issue = ?, github_issue_state = ?
     WHERE id = ? AND created_at = ?
       AND (github_issue IS NULL OR github_issue = ?)
       AND (github_issue IS NOT ? OR github_issue_state != ?)`,
  );
  let changed = 0;
  db.transaction(() => {
    for (const l of links) {
      changed += update.run(l.issue, l.state, l.id, l.createdAt, l.issue, l.issue, l.state).changes;
    }
  })();
  return changed;
}
