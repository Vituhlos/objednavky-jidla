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

## 2026-08-04 – HeroUI pilot seznamu historie

### Rozsah

- `/historie` je přestavěná na stock HeroUI `Surface`, `Card`, `Table`,
  `SearchField`, `Switch`, `Chip`, `Typography`, `EmptyState` a `Button`.
- Staré ruční tabulky, inline barvy, glass třídy, gradientový switch a `MIcon`
  byly z migrované stránky odstraněny.
- Data, řazení, hide-empty pravidlo, datum/e-mail search a detailní routy zůstaly
  stejné.
- Filtrování, mapování a české formátování/počty jsou v testovaném helper modulu.
- Shared sidebar clock už na `/historie` nevytváří hydration mismatch.

### Designové rozhodnutí

- Plnošířkový legacy topbar nebyl napodoben. Nadpis a ovládání jsou v kompaktní,
  centrované produktové kompozici na `surface-secondary`.
- Výchozí bílá HeroUI karta je oddělená pouze standardním povrchem a shadow
  komponenty; nebyl přidán vlastní border ani barva.
- Při vypnuté pizze obědová historie využije celou obsahovou šířku. Při zapnuté
  pizze se od `xl` zobrazí dvě rovnocenné sekce.

### Commit

- `3c71256 feat: migrate history list to HeroUI`

### Ověření

- `npm test`: 19/19 testů prošlo.
- Cílený ESLint a `npx tsc --noEmit` prošly bez výstupu.
- Produkční build prošel.
- Chromium 1695×920 a 390×844: vizuální hierarchie, responzivní sloupce,
  hledání, zrušení hledání, switch a prázdné stavy prošly.
- Myš i klávesnice otevřely původní detailní routu; konzole byla bez chyb.

### Další krok

- Migrovat `/historie/[id]`, potom `/historie/pizza/[id]`, se stejnými HeroUI
  guardrails a samostatnými commity.

## 2026-08-04 – finální doladění workspace historie

### Rozsah

- Seznam historie používá jednu adaptivní pracovní plochu: krátký obsah má
  přirozenou výšku, dlouhý obsah scrolluje uvnitř dostupného viewportu se sticky
  záhlavím. Dokument samotný nepřetéká.
- Desktop získal HeroUI třídění podle data a počtu řádků; mobil samostatný
  plnořádkový seznam s HeroUI hover, pressed a focus stavy.
- Přidán ikonový HeroUI empty/filtered-zero stav a `app/historie/loading.tsx` se
  Skeleton podobou desktopové tabulky i mobilního seznamu.
- `Surface` stránky je výchozí a HeroUI Table používá svůj sekundární povrch, takže
  tabulka sedí na pozadí stejně jako v oficiálních ukázkách.
- Legacy `--muted` byl přejmenován na `--legacy-muted`, aby nepřepisoval HeroUI
  token; globální focus ring používá HeroUI `--focus`.
- Kategorie Obědy/Pizza používají HeroUI Tabs jen při zapnuté pizze. V běžném
  vypnutém stavu se nezobrazuje osamocený nebo mrtvý tab.

### Stavová a přístupnostní rozhodnutí

- Řádek je jediná navigační akce. Šipka reaguje na hover/focus celého řádku, ale
  nemá tooltip, protože samostatně klikací není; přístupný název záznamu říká
  „Otevřít objednávku…“.
- HeroUI zajišťuje hover/pressed/focus pro tabulkové řádky, mobilní ghost odkazy,
  switch, search a případné tabs. Empty a filtered-zero jsou obsahově odlišené.
- Loading se nepředstírá pomocí `Table.LoadMore`: SQLite vrací celý seznam
  synchronně. Route Skeleton je připravený pro skutečné čekání/suspense; zpomalená
  klientská navigace zatím plynule drží předchozí obraz do dokončení.

### Kapacita a ověření

- Produkce má přibližně 67 záznamů. `getOrderList()` nemá limit a tento objem je
  bezpečně pod hranicí, kde by virtualizace přinesla užitek; zvažovat ji až podle
  měření při řádově vyšších počtech.
- `npm test`: 20/20; celý ESLint, TypeScript a produkční build prošly.
- Chromium 1366×768, 390×844 a 320×700: krátký/dlouhý seznam, vnitřní scroll,
  sticky header, hover, keyboard focus, search, empty state a třídění prošly.
- Měřeno: desktop dokument `768/768`, tabulka `596/864`; mobil dokument `844/844`,
  seznam `520/1473`. Konzole bez aplikačních chyb.

### Commit

- `ad7135c feat: refine HeroUI history workspace`

### Další krok

- Migrovat používaný obědový detail `/historie/[id]`. Pizza detail ponechat
  kompatibilní, ale neupřednostňovat, dokud je modul v ostré verzi vypnutý.
