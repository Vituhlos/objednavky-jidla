# UX / a11y audit skripty

Jednorázové Playwright nástroje pro audit Kantýny. **Nejsou součástí buildu** — spouštěj jen při ručním QA.

Požadavky: běžící dev server (`npm run dev`), Playwright (`npx playwright install chromium`).

| Skript | Účel |
|--------|------|
| `nielsen-audit.mjs` | Nielsen heuristiky + screenshoty |
| `responsiveness-test.mjs` | Breakpoint sweep |
| `wcag-audit.mjs` | WCAG (axe-core) |
| `ux-audit-automated.mjs` | Automatizovaný UX audit |
| `ux-rethink-audit.mjs` | UX rethink audit |
| `contrast-check.mjs` | Kontrast barev |

Screenshoty se ukládají do `docs/audit/screenshots/` (gitignored).

```powershell
npm run dev
node scripts/audit/nielsen-audit.mjs
```
