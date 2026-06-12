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

### Release a verzování

- Projekt používá profesionální release proces popsaný v `docs/release-process.md`.
- Při změně produktového chování, Docker image, databáze, env proměnných, GitHub Actions nebo uživatelského workflow vždy zvaž dopad na SemVer (`PATCH`, `MINOR`, `MAJOR`) a aktualizuj nebo navrhni položku v `CHANGELOG.md`.
- Commit zprávy mají používat Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `build:`, `refactor:`, `test:`, `chore:`).
- Release se má vydávat přes anotovaný git tag `vX.Y.Z`; Docker image nemá spoléhat jen na `latest`.
- AI nesmí vytvořit nebo pushnout release tag bez výslovného souhlasu člověka.
