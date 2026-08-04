# HeroUI migration log

Chronologický, append-only protokol práce. Aktuální stručný stav je v
`docs/MIGRATION-HANDOFF.md`; tento soubor uchovává historii rozhodnutí a ověření.

## 2026-08-04 – založení migrace a strukturální pojistky

### Rozsah

- Založen worktree `docker-app-heroui` a branch `feat/heroui-migration` z commitu
  `d49bc416ec1c9e33e5a774339bd6f773d5668943`.
- Připraven HeroUI React skill, HeroUI MCP a lokální `agents-md` dokumentace.
- Přidán přenositelný projektový `.mcp.json`; Claude Code ho úspěšně rozpoznal a
  čeká pouze na jednorázové interaktivní schválení.
- Ověřena dostupnost HeroUI `3.2.3`; `@heroui/react` a `@heroui/styles` jsou
  připnuté přesně na tuto verzi.
- Přidán HeroUI runtime základ bez vizuální změny existujících stránek.
- Doplněna Phase A-lite: Vitest, testy čisté logiky a první rozdělení Settings.

### Rozhodnutí

- Funkční chování je nadřazené vizuální změně.
- První podoba používá stock HeroUI bez starých barev, glassmorphismu a gradientů.
- Legacy CSS zůstane pro dosud nemigrované stránky.
- První vizuální pilot bude `/historie`, protože je read-only.
- `SettingsPage` se bude dál dělit podle produktových domén, ne pouze podle délky
  souboru.

### Commity

- `37cbd43 chore: prepare HeroUI migration tooling`
- `8001550 docs: define HeroUI migration guardrails`
- `826ae21 chore: add HeroUI runtime foundation`
- `47762f7 refactor: centralize frontend helpers with tests`
- `4418595 refactor: split settings page foundations`

### Ověření

- `npm test`: 14/14 testů prošlo.
- Cílený ESLint prošel.
- Produkční build prošel.
- `/`, `/historie`, `/jidelnicek`, `/pizza` a `/nastaveni` byly dříve otevřeny v
  reálném prohlížeči; po settings refaktoru navíc `/nastaveni` vrátilo HTTP 200.
- Hydration warning na `/` byl reprodukován i na nezměněném `main` a je tedy
  evidovaný jako předexistující.

### Další krok

- HeroUI pilot seznamu `/historie` podle `docs/MIGRATION-HANDOFF.md`.

## 2026-08-04 – podpora Claude Desktop Code

- Ověřeno v oficiální dokumentaci, že Code tab používá stejné projektové
  `CLAUDE.md` a `.mcp.json` jako Claude Code CLI.
- Přidáno `.claude/settings.json` s `worktree.baseRef: head`, aby automatické
  desktopové worktrees vycházely z lokální HeroUI migrační větve a ne ze starého
  `origin/HEAD`.
- Přidáno `.worktreeinclude` pro přenos ignorované `.heroui-docs/` do izolovaných
  worktrees.
- Přidáno `.claude/launch.json` pro Desktop preview na portu 3020.
- Nastaveno `NODE_OPTIONS=--use-system-ca` pro lokální Claude Code prostředí kvůli
  lokálnímu TLS certifikátu při npm/npx voláních.
