# HeroUI migration handoff

Tento soubor je živý stav projektu pro člověka, Codex i Claude. Před další prací
ho vždy přečti společně s `docs/heroui-migration-plan.md`. Po každém dokončeném
logickém kroku ho aktualizuj a přidej záznam do `docs/MIGRATION-LOG.md`.

## Rychlá orientace

| Položka | Aktuální hodnota |
|---|---|
| Projekt | Kantýna – objednávky obědů a pizzy |
| Samostatný worktree | `C:\Users\Pech\Downloads\Objednavani jurka\docker-app-heroui` |
| Branch | `feat/heroui-migration` |
| Výchozí commit z `main` | `d49bc416ec1c9e33e5a774339bd6f773d5668943` |
| Poslední implementační commit | `ad7135c feat: refine HeroUI history workspace` |
| HeroUI | přesně `3.2.3` |
| Stav serveru | dev server běží na `http://localhost:3020` nad preview DB `data/stros-preview-20260804.db` |
| Poslední aktualizace | 2026-08-04 |

Pracuj pouze v uvedeném worktree. Původní worktree s `main` se pro migraci
nemění.

## Claude Desktop – záložka Code

Tento projekt je připravený primárně i pro Claude Desktop Code:

1. V nové Code session vyber prostředí **Local** a jako project folder přesně
   `C:\Users\Pech\Downloads\Objednavani jurka\docker-app-heroui`.
2. Desktop automaticky načte kořenový `CLAUDE.md`, projektový `.mcp.json` a
   `.claude/settings.json`.
3. Při prvním použití schval projektový MCP server `heroui-react`.
4. Každá Desktop Code session běží v automaticky izolovaném worktree.
   `.claude/settings.json` nastavuje `worktree.baseRef` na `head`, takže nová
   session vychází z aktuálního lokálního migračního commitu místo ze starého
   `origin/HEAD`.
5. `.worktreeinclude` kopíruje ignorovanou `.heroui-docs/` i do desktopového
   worktree. `node_modules` se nekopíruje; v nové session může být potřeba
   `npm ci`.
6. Preview „Kantýna HeroUI“ je v `.claude/launch.json` připravené na portu 3020.

Desktopová session obvykle commitne práci na své izolované větvi. Před ukončením
si vždy nech vypsat commit SHA a stav worktree. Commit se pak začlení do
`feat/heroui-migration` pomocí běžného merge/cherry-pick workflow; agent nesmí
bez instrukce přepisovat nebo resetovat migrační větev.

## Cíl a neměnné zásady

- Zachovat veškeré produktové chování, routy, server actions, SQLite, SSE,
  scheduler, Telegram, e-mail, PDF a PWA.
- Přestavět frontend na výchozí neutrální HeroUI v3 bez současné amber/stone
  palety, glassmorphismu, gradientů a dekorativních animací.
- Sémantické HeroUI stavy `success`, `warning` a `danger` jsou povolené.
- Barvy oddělení zůstanou v databázi, ale první migrované UI je nezobrazuje.
- Neprovádět release, deployment ani vytváření/pushování tagů bez výslovného
  souhlasu uživatele.

Autoritativní podrobnosti jsou v `docs/heroui-migration-plan.md`; funkční pojistky
jsou v `docs/heroui-behavior-checklist.md`.

## Aktuální stav

| Etapa | Stav | Poznámka |
|---|---|---|
| Samostatný branch/worktree | hotovo | založeno z aktuálního `main` |
| HeroUI tooling | hotovo | skill, docs index a MCP připravené |
| HeroUI runtime | hotovo | styles import + `I18nProvider` s `cs-CZ` |
| Phase A-lite | první část hotová | Vitest, sdílené helpery, první rozdělení Settings |
| Behavior baseline | hotovo pro hlavní routy | viz checklist; `/` má známý starý hydration warning |
| Vizuální HeroUI migrace | probíhá | seznam historie je první hotový pilot |
| Pilot `/historie` | hotovo | adaptivní stock HeroUI workspace, desktop/mobile/loading/keyboard ověřeno |

## Co už bylo dokončeno

1. `37cbd43 chore: prepare HeroUI migration tooling`
   - HeroUI balíčky připravené a připnuté na `3.2.3`.
   - Lokální HeroUI dokumentace je generovaná v ignorované `.heroui-docs/react`.
2. `8001550 docs: define HeroUI migration guardrails`
   - Migrační plán a behavior checklist.
3. `826ae21 chore: add HeroUI runtime foundation`
   - `@heroui/styles`, `I18nProvider`, locale `cs-CZ`.
4. `47762f7 refactor: centralize frontend helpers with tests`
   - Vitest a skripty `npm test` / `npm run test:watch`.
   - Sdílené `lib/format.ts` a použití společného Prague-time helperu.
5. `4418595 refactor: split settings page foundations`
   - `SettingsPage.tsx` zmenšen z 2319 na 1946 řádků.
   - Nové moduly v `app/components/settings/`.
   - Čisté mapování formuláře, datumové helpery a validace mají testy.
6. `3c71256 feat: migrate history list to HeroUI`
   - Seznam `/historie` používá stock HeroUI komponenty a výchozí neutrální
     povrchy bez legacy barev, glass tříd, gradientů nebo inline stylů.
   - Filtry a formátování jsou oddělené v `app/components/history/history-utils.ts`
     a pokryté testy.
   - HeroUI Table zachovává lunch/pizza odkazy a přidává správnou klávesnicovou
     navigaci; mobil skrývá pouze vedlejší sloupce.
   - Opraven server/client mismatch hodin ve sdíleném sidebaru.
7. `ad7135c feat: refine HeroUI history workspace`
   - Výchozí HeroUI `Surface` odděluje stránku od sekundárního povrchu tabulky;
     odstraněna kolize legacy `--muted` tokenu s HeroUI a globální focus používá
     sémantický HeroUI token.
   - Krátká tabulka/list se výškově přizpůsobí obsahu, dlouhá využije dostupnou
     plochu a scrolluje uvnitř se sticky záhlavím.
   - Desktopová tabulka třídí datum a počet řádků; mobil používá plnořádkové
     HeroUI odkazy s hover/pressed/focus stavy.
   - Přidán skutečný route loading skeleton a ikonové empty/filtered-zero stavy.
   - Tabs se renderují pouze při zapnutém pizza modulu; vypnutá pizza nezanechá
     v rozhraní osamocený tab ani jinou stopu.

## Poslední známé ověření

Pro stav na commitu `ad7135c` platí:

- `npm test`: 3 test files, 20 testů prošlo.
- Celý `npm run lint` prošel bez výstupu.
- `npx tsc --noEmit`: prošel bez výstupu.
- `npm run build`: prošel, všechny routy byly vygenerované.
- Chromium desktop 1366×768 a mobil 390×844/320×700: adaptivní krátký i dlouhý
  seznam, hledání, empty/filtered-zero, hover, sticky header a třídění prošly.
- Dlouhý desktop: dokument `768/768`, vnitřní tabulka `596/864`; dlouhý mobil:
  dokument `844/844`, vnitřní seznam `520/1473`. Stránka sama nepřetéká.
- Klávesnice: switch funguje přes Space, tabulka/list mají souvislý HeroUI focus
  ring a záznamy mají popisný přístupný název.
- Konzole `/historie` byla bez chyb. Dev server na portu 3020 zůstává úmyslně
  spuštěný pro uživatelské vizuální hodnocení.

## Známé problémy a úmyslně odložené věci

- Na `/` existuje hydration mismatch kolem responzivních ovládacích prvků push
  notifikací/headeru. Stejný warning byl reprodukován na nezměněném `main`, takže
  ho nezpůsobila HeroUI větev. Je zapsaný v behavior checklistu.
- Vizuální shell a detailní stránky historie jsou stále legacy. Pilot změnil jen
  seznam `/historie`; proto je vedle neutrální stránky stále vidět starý teplý
  sidebar. Sdílený sidebar clock dostal pouze opravu hydratace.
- Pizza modul je v aktuálním ostrém nasazení vypnutý a podle uživatele se nejspíš
  brzy nevrátí. Kód dál zachovává kompatibilitu, ale vypnutá pizza se nesmí
  vizuálně připomínat a její detail není prioritní migrační krok.
- `getOrderList()` nemá SQL `LIMIT`; současný adaptivní workspace je určen pro
  desítky až nižší stovky řádků (ostrý stav je přibližně 67). Virtualizaci nebo
  serverové stránkování přidat až podle měření při řádově vyšších objemech.
- `SettingsPage.tsx` je stále příliš velký. Další rozdělení má proběhnout podle
  domén (`provoz`, `lidé`, `ceny`, `napojení`, `pizza`, `systém`), ideálně při
  migraci Settings. Cílem je z něj udělat koordinátor, ne jen přesunout JSX.
- Legacy CSS a aktuální barvy zůstávají pro nemigrované stránky. Mazat je až podle
  skutečného používání.
- Globální konfigurace Codex MCP není součástí Gitu. Projektový `.mcp.json`
  zpřístupňuje stejný HeroUI server nástrojům, které tento formát podporují.
- Claude Code `2.1.162` projektový server rozpoznal jako `heroui-react`. Při prvním
  spuštění Code session v tomto repozitáři je ve stavu `Pending approval` a musí
  se jednorázově schválit v Claude Desktop nebo interaktivním CLI.

## Přesný doporučený další krok

1. Ověřit `git status --short --branch` a přečíst:
   - `docs/heroui-migration-plan.md`
   - `docs/heroui-behavior-checklist.md`
   - tento handoff
2. Před implementací přečíst lokální HeroUI 3.2.3 dokumentaci pro použité
   komponenty v `.heroui-docs/react/` a případně ověřit instalované TypeScript
   deklarace.
3. Migrovat read-only detail obědové historie `/historie/[id]`:
   - zachovat oddělení, řádky, poznámky, ceny, PDF a všechny akce;
   - před změnou zapsat stavovou matici a ověřit HeroUI API v lokálních docs;
   - nepřenášet staré barevné nebo glass třídy.
4. `/historie/pizza/[id]` migrovat stejným vzorem pouze pokud se pizza modul
   znovu stane produktovou prioritou; zatím zachovat funkční kompatibilitu.
5. Pro každý detail spustit `npm test`, cílený ESLint, `npm run build` a
   desktop/mobile/keyboard smoke test a vše zapsat do checklistu a logu.

## Pravidla předání mezi agenty

Každý agent má před ukončením práce:

1. Uvést v tomto souboru aktuální etapu, poslední commit, ověření, známé problémy
   a jediný doporučený další krok.
2. Do `docs/MIGRATION-LOG.md` přidat nový záznam; starší záznamy nepřepisovat.
3. Změny rozdělit do logických Conventional Commitů.
4. Nenechat bez vysvětlení rozpracovaný server, dočasné screenshoty ani
   necommitnuté generované soubory.
5. Pokud worktree není čistý, přesně popsat které soubory jsou rozpracované a co
   v nich zbývá.

## Startovací prompt pro Claude nebo jiného agenta

> Pracuj v `C:\Users\Pech\Downloads\Objednavani jurka\docker-app-heroui` na
> branchi `feat/heroui-migration`. Nejdřív přečti `AGENTS.md`, `CLAUDE.md`,
> `docs/MIGRATION-HANDOFF.md`, `docs/heroui-migration-plan.md` a
> `docs/heroui-behavior-checklist.md`. Pokračuj přesně od doporučeného dalšího
> kroku, zachovej produktové chování a před koncem aktualizuj handoff i
> `docs/MIGRATION-LOG.md`.

Pro Claude Desktop Code v promptu není nutné opakovat celý technický kontext:
`CLAUDE.md` se načítá automaticky. Výše uvedený prompt ale jasně určí, že má agent
pokračovat z handoffu a na konci zanechat znovu převzatelný stav.
