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
