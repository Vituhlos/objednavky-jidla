# Changelog

Všechny významné změny tohoto projektu budou dokumentované v tomto souboru.

Formát vychází z Keep a Changelog a projekt používá Semantic Versioning.

## [Unreleased]

### Fixed

- Když se objednávka po uzávěrce znovu otevřela, uzávěrka se ten den už nikdy nezapnula — příznak odemčení nesl jen datum, takže přenastavení času uzávěrky nemělo kam zabrat. Nově se pamatuje i čas odemčení a platí pravidlo „odemčení promíjí jen tu uzávěrku, která už proběhla". Odemčeno v 8:05 a uzávěrka přesunutá na 8:10 tedy v 8:10 zase zamkne; odemčení předtím platné uzávěrky se nemění.
- Po odemčení appka dál hlásila „Po uzávěrce (08:00)" a v panelu „Objednávky uzavřeny", i když objednávat šlo. Nově ukazuje „Objednávání odemčeno" s tím, kdy se objednávka odešle.

### Added

- `npm test` — vitest nad `app/` a `lib/` plus dosavadní `node --test` nad `tools/`. Přibyly testy vyhodnocení uzávěrky (`tools/cutoff.test.mjs`) a odesílací cesty objednávky (`tools/orders-send.test.mjs`) proti dočasné SQLite a falešnému SMTP serveru. Pokrývají dvojí odeslání, návrat na draft při chybě SMTP, chování „Znovu odeslat email" i přepis archivovaného PDF.

### Changed

- Interně: z `OrderPage.tsx` se vydělily čtyři hooky do `app/components/order/` — `useOrderSync` (živá synchronizace přes SSE), `useDayNavigation` (přepínání dnů páskem i šipkami), `useRowDeletion` (mazání s pětivteřinovým oknem na vrácení) a `usePushNotifications`. Komponenta klesla z 1 466 na 1 118 řádků. Chování zůstává beze změny; ověřeno proklikáním přidání, mazání i přepínání dnů.
- Interně: pomocné funkce objednávkové obrazovky (práce s daty, sestavení přepínače dnů, přepočet oddělení) se přesunuly z `OrderPage.tsx` do `app/components/order/order-utils.ts`. Těla funkcí jsou beze změny — jde o přesun, ne přepis. `OrderPage.tsx` je o 124 řádků kratší a na funkce nově dosáhne 36 testů. Umístění i názvy odpovídají větvi `feat/heroui-migration`, aby se obě verze strukturálně sbíhaly.
- Interně: `sendOrder()` a `resendOrderEmail()` sdílí přípravu e-mailu a jeho odeslání s archivací. Dřív obě funkce opakovaly stejných dvanáct kroků, což byl důvod, proč jedné z nich chyběl zápis do archivu. Chování obou zůstává beze změny.

## [1.3.1] - 2026-08-21

### Fixed

- Objednávkové PDF se rozpadlo, jakmile se tabulka oddělení nevešla na stránku. Z objednávky na 21. 8. 2026 (23 objednávek) vypadlo 51 stran, na kterých byly jednotlivé útržky — na jedné jen pořadové číslo, na další jen jméno, a rámečky s podbarvením zůstaly na předchozí straně. Tabulka se teď stránkuje sama: na každé další straně se zopakuje hlavička sloupců a nadpis oddělení s poznámkou „(pokračování)", číslování řádků plynule navazuje.
- Patička „Vygenerováno automaticky" byla jen na poslední straně. Nově je na každé, a u vícestránkových objednávek přibylo označení „Strana X / Y".
- „Znovu odeslat email" v Nastavení přeposlalo aktuální PDF, ale neaktualizovalo archivovanou kopii. Stažení z historie a Telegram tak mohly nabízet starší verzi, než jaká odešla e-mailem.

### Added

- `npm run test:pdf` — regresní test stránkování objednávkového PDF (23 až 800 řádků, jedno i pět oddělení). Hlídá, že počet stran odpovídá počtu řádků, že každá strana nese hlavičku tabulky a že nevznikají skoro prázdné strany.

### Migration notes

- Žádné. Beze změny databáze, env proměnných, Docker konfigurace i formátu záloh. Aktualizace i návrat na `1.3.0` jsou bez dalších kroků.
- Už odeslané objednávky si podržely původní PDF. Opravenou verzi dostanou tím, že se objednávka znovu otevře a odešle, nebo přes „Znovu odeslat email" v Nastavení.
- Volitelná proměnná `PDF_FONT_DIR` umožní spustit generátor PDF mimo Docker (potřebuje ji `npm run test:pdf`). Nenastavená se chová jako dosud a v produkci ji není potřeba nastavovat.

## [1.3.0] - 2026-08-04

### Changed

- Objednávková stránka ukazuje během zavření stejnou kartu jako jídelníček — název zavření, období, poslední oběd a den návratu. Dřív tam byla obecná šedá cedule „Zavřeno" a název dovolené se krčil v drobném řádku pod ní.
- Přepínač dnů počítá zavřený dnešek jako součást zavřeného období. Dřív se zobrazoval zvlášť jako přeškrtnutý „Dnes" vedle předělu, jehož rozsah kvůli tomu začínal až následující den.
- Předěl zavřeného období ukazuje ikonu zavření stejně jako záložky týdnů v jídelníčku a dá se přes něj vrátit na dnešek.
- Karta zavření je zarovnaná doleva a emoji stojí vedle názvu místo v šedé dlaždici nad ním, takže se čte jedním směrem shora dolů.
- Ručně zavřený den používá v přepínači stejný typ ikony jako dovolená, ne odlišný symbol.

### Fixed

- Karta zavření na objednávkové stránce se smrskávala na šířku textu, takže se dvojice „poslední oběd" a „vaří se zase od" tiskly k sobě a hlavička s patičkou působily jako dvě samostatné karty.
- Popisky „poslední oběd" a „vaří se zase od" byly příliš světlé na to, aby splnily požadavek na kontrast textu. Totéž platilo pro neaktivní dny v přepínači a pro označení zavřeného období.
- Název zavření je nadpisem stránky, takže čtečka obrazovky oznámí, proč je stránka bez objednávek. Dřív na obou obrazovkách nebyl žádný nadpis.
- Označení aktuálního zavřeného období v přepínači přestalo být nedostupným tlačítkem — klávesnice ho přeskakovala a jeho vysvětlující popisek se tím pádem nedal zobrazit.

### Known issues

- Předěl v přepínači dnů uvádí jen zbývající zavřené dny, zatímco karta pod ním uvádí celé období. Druhý a další den dovolené si tak obě čísla neodpovídají (například „zavřeno 4.–7. 8." nad kartou „Od 3. 8. do 7. 8.").

## [1.2.1] - 2026-07-30

### Fixed

- Zadané zavření provozu nešlo upravit. Oprava překlepu v popisu nebo posun termínu vyžadovaly smazání a zadání celého záznamu znovu, což navíc blokovala kontrola překryvu — opravenou verzi nešlo zadat vedle původní.

### Changed

- Zavření se upravuje ve stejném formuláři, jaký slouží pro zakládání. Kontrola překryvu při úpravě ignoruje upravovaný záznam, takže lze změnit popis, poznámku nebo ikonu beze změny termínu.

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
