# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Kantýna je single-service Next.js 16 aplikace (App Router, React 19, TypeScript strict) se SQLite databází (better-sqlite3). Běží jako jeden proces — žádné externí databáze ani služby nejsou potřeba pro vývoj.

### Spuštění

- **Dev server:** `npm run dev` — spustí na http://localhost:3000
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint, codebase má ~42 pre-existujících warningů/errorů)
- **Testy:** žádný testovací framework není nastavený

### Důležité poznámky

- SQLite databáze se vytvoří automaticky v `./data/stros.db` při prvním přístupu (migrace proběhnou automaticky).
- `better-sqlite3` je nativní modul — vyžaduje `python3`, `make`, `gcc` pro kompilaci. Tyto nástroje jsou v Cloud VM přítomny.
- Scheduler (node-cron) se spouští automaticky přes `instrumentation.ts` při startu Node.js procesu. Všechny funkce (auto-send, IMAP, push notifikace, Telegram) jsou ve výchozím stavu vypnuté.
- SMTP, IMAP, Telegram a Web Push jsou volitelné služby — aplikace funguje plně i bez nich.
- Nastavení se konfiguruje přes UI na `/nastaveni` (výchozí PIN: `1234`).
- Viz `README.md` pro přehled env proměnných a `CLAUDE.md` pro detailní kontext kódu.

### Gravity UI (větev GravityUI)

Experiment s přechodem na [@gravity-ui/uikit](https://gravity-ui.com/).

**Oficiální AI dokumentace (vendored):**

- `docs/gravity-ui/official/uikit-AGENTS.md` — [uikit/AGENTS.md](https://github.com/gravity-ui/uikit/blob/main/AGENTS.md)
- `docs/gravity-ui/official/navigation-agents.md` — [navigation/agents.md](https://github.com/gravity-ui/navigation/blob/main/agents.md)
- `docs/gravity-ui/official/aikit-AI_AGENTS.md` + `aikit-llms.txt` — AIKit (volitelné)

**Agenti v projektu:**

| Typ | Soubor |
|-----|--------|
| Index | `docs/gravity-ui/README.md` |
| Cursor rule UIKit | `.cursor/rules/gravity-ui.mdc` |
| Cursor rule AIKit | `.cursor/rules/aikit.mdc` (volitelné) |
| Skill UIKit | `.claude/skills/gravity-ui/SKILL.md` |
| Skill AIKit | `.claude/skills/aikit/SKILL.md` |
| MCP | `.cursor/mcp.json.example` → zkopíruj na `mcp.json` (gitignored) |
| Gravity komponenty | `components/gravity/` (`GravityRoot`, `iconRegistry`, …) |
| UX audit skripty | `scripts/audit/` (volitelné, mimo build) |

Setup:

```powershell
.\scripts\setup-gravity-ui.ps1          # npm + MCP clone
.\scripts\sync-gravity-official-docs.ps1  # aktualizace oficiálních docs
Copy-Item .cursor\mcp.json.example .cursor\mcp.json  # uprav absolutní cestu k repu
```

Po změně MCP **restartuj Cursor**. UIKit nemá `llms.txt` — pro API komponent používej MCP `find`/`get`.

Gravity CSS **nepatří** do root `app/layout.tsx` — jen do `app/gravity-preview/layout.tsx` (dočasně, dokud nebude greenfield shell).

### Struktura repa (GravityUI větev)

```
app/                    # Next.js routes + legacy UI komponenty
components/gravity/     # Gravity UI wrappery a ikony
docs/gravity-ui/        # Vendored oficiální Gravity docs
scripts/                # setup/sync + scripts/audit/ (QA)
tools/                  # gravityui-reference-mcp (gitignored, clone přes setup)
```

**Nepatří do gitu:** `.agents/`, `.claude/worktrees/`, `skills-lock.json`, `docs/audit/screenshots/`, `.cursor/mcp.json`.
