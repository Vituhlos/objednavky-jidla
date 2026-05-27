# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Kantýna je single-service Next.js 16 aplikace (App Router, React 19, TypeScript strict) se SQLite databází (better-sqlite3). Tato branch (`v2-auth-sso-versioning`) přidává SSO autentizaci přes `next-auth` v5 beta, uživatelské profily s rolemi a admin řízení přístupu.

### Spuštění

- **Dev server:** `npm run dev` — spustí na http://localhost:3000
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint, codebase má ~42 pre-existujících warningů/errorů)
- **Testy:** žádný testovací framework není nastavený

### Důležité poznámky

- **Instalace závislostí vyžaduje `--legacy-peer-deps`** kvůli peer dependency konfliktu mezi `next-auth@5.0.0-beta.31` (vyžaduje `nodemailer@^7`) a `nodemailer@^8` v root projektu. Bez tohoto flagu `npm install` selže.
- SQLite databáze se vytvoří automaticky v `./data/stros.db` při prvním přístupu (migrace proběhnou automaticky).
- `better-sqlite3` je nativní modul — vyžaduje `python3`, `make`, `gcc` pro kompilaci. Tyto nástroje jsou v Cloud VM přítomny.
- Scheduler (node-cron) se spouští automaticky přes `instrumentation.ts` při startu Node.js procesu. Všechny funkce (auto-send, IMAP, push notifikace, Telegram) jsou ve výchozím stavu vypnuté.
- SMTP, IMAP, Telegram a Web Push jsou volitelné služby — aplikace funguje plně i bez nich.
- Autentizace (next-auth) běží v guest/anonymous módu pokud nejsou nakonfigurovány OIDC env proměnné. Aplikace je plně funkční i bez SSO providera.
- Nastavení se konfiguruje přes UI na `/nastaveni` (výchozí PIN: `1234`).
- Viz `README.md` pro přehled env proměnných a `CLAUDE.md` pro detailní kontext kódu.
