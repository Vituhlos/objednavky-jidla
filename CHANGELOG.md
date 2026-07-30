# Changelog

Všechny významné změny tohoto projektu budou dokumentované v tomto souboru.

Formát vychází z Keep a Changelog a projekt používá Semantic Versioning.

## [Unreleased]

Zatím žádné nevydané změny.

## [1.2.0] - 2026-07-30

### Added

- Přidána správa zavření provozu (dovolená, údržba, svátek) v Nastavení — období se zadává dopředu, nezávisle na importu jídelníčku.
- Přidáno upozornění na blížící se zavření na objednávkové stránce včetně data posledního oběda a dne, kdy se zase začne vařit.
- Přidán výběr vlastní ikony u každého zavření z 1914 emoji, s hledáním a kategoriemi.
- Přidán samostatně hostovaný font Noto Color Emoji, aby emoji vypadala stejně na Windows, macOS, iOS i Androidu.
- Jídelníček nově zobrazuje i týdny za příštím týdnem, pokud pro ně existuje jídelníček nebo zavření.
- Nastavení má postranní navigaci s kategoriemi podle úkolu a lištu neuložených změn s vyznačením kategorie, které se týkají.
- Telegram bot upozorňuje na zavřený den i na blížící se dovolenou.

### Changed

- Přepínač dnů na objednávkové stránce zobrazuje souvislé zavřené období jako jeden tichý předěl místo jednotlivých nedostupných dnů.
- Jídelníček nahradí mřížku dnů jedním panelem, když je celý zobrazený týden zavřený.
- Zprávy bota o odeslané objednávce se skládají na jednom místě, takže hlásí stejná čísla bez ohledu na to, jestli objednávku odeslal člověk nebo automat.
- Přepínač týdnů v jídelníčku má stejné rozměry jako přepínač dnů na objednávkové stránce a splňuje minimální velikost dotykového cíle.

### Fixed

- Bot ukazoval z objednávky jen první polévku a první jídlo; druhé polévky, další jídla, počty porcí ani přílohy se nezobrazovaly.
- Horní lišta objednávkové stránky měnila výšku podle toho, jestli se v ní zobrazovalo tlačítko Odeslat.
- Postranní navigace v Nastavení byla u vyšších kategorií odsazená pod první kartu.
- Zrušení objednávky přes bota neodemklo objednávky po uzávěrce, na rozdíl od stejné akce v aplikaci.
- Vyčerpaný limit pokusů o zadání PINu se hlásil jako nesprávný PIN; nově se zobrazí zbývající čas.
- Doplněno 27 chybějících ikon, které se dosud tiše nevykreslovaly; neznámé jméno ikony nově hlásí varování ve vývojovém režimu.
- Zavření nešlo zadat s obráceným rozsahem dat ani překryvem s jiným zavřením; obojí se nyní hlásí místo tichého opravení.
- Smazání zavření vyžaduje potvrzení.

### Security

- Inline režim Telegram bota vydával celou objednávku včetně jmen komukoli, kdo znal jméno bota, bez kontroly registrace.
- Webhook Telegram bota přijímal jakýkoli požadavek; nově ověřuje sdílený secret token.
- Hodnoty od uživatelů se ve zprávách bota neescapovaly, takže znak `<` v názvu jídla nebo jména odmítl celou zprávu.
- Odesílání zpráv nekontrolovalo odpověď Telegramu, takže odmítnutá zpráva vypadala jako doručená; zablokované odběry se nově odstraňují.

### Migration notes

- Databáze se rozšiřuje automaticky při startu o tabulku `closures` a sloupce `note` a `icon`. Zásah není potřeba, starší zavření dostanou výchozí ikonu.
- Po nasazení je nutné znovu zaregistrovat webhook Telegram bota v Nastavení → Napojení. Tím se vygeneruje secret token; do té doby webhook běží bez ověření a v logu na to upozorňuje.
- Font emoji a seznam emoji jsou statické soubory v `public/`. Chybí-li, aplikace se vrátí k systémovým emoji a nic se nerozbije.

## [1.1.1] - 2026-06-12

### Changed

- Unraid template nově používá Docker tag `stable`, aby běžná aktualizace nevyžadovala ruční přepis verze image.
- Stabilní release workflow nově publikuje Docker tag `stable` vedle přesných SemVer tagů.

## [1.1.0] - 2026-06-12

### Added

- Přidán profesionální release proces pro verzování, changelog, commit zprávy a Docker tagování.
- Přidán endpoint `/api/version` s diagnostikou aktuálně běžící verze.
- Přidán endpoint `/api/health` pro monitoring, Docker healthcheck a ověření databáze.
- Přidán panel `O aplikaci` v nastavení se zobrazením verze, commitu, data buildu, kanálu, git refu a Docker tagu.
- Přidán modal `Co je nového` s produktovými release notes přímo v aplikaci.
- Přidána GitHub issue šablona pro release checklist.
- Přidán GitHub Release workflow generovaný z `CHANGELOG.md`.
- Přidána CI kontrola, která u produktových PR hlídá changelog nebo release notes.

### Changed

- Budoucí změny mají být připravované tak, aby bylo jasné, jestli vyžadují `PATCH`, `MINOR` nebo `MAJOR` release.
- Docker build přijímá release metadata a GitHub Actions umí publikovat SemVer Docker tagy z git tagů `vX.Y.Z`.
- Docker image obsahuje `HEALTHCHECK` napojený na `/api/health`.
- README nově doporučuje pinovat produkční nasazení na konkrétní verzi a popisuje aktualizaci, rollback a monitoring.

## [1.0.2] - 2026-06-12

### Changed

- Aktuální výchozí verze projektu zachycená z `package.json`.

### Known issues

- Historické změny před zavedením tohoto changelogu nejsou zpětně rozepsané podle jednotlivých verzí.
