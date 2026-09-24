# Changelog

Všechny významné změny tohoto projektu budou dokumentované v tomto souboru.

Formát vychází z Keep a Changelog a projekt používá Semantic Versioning.

## [Unreleased]

## [1.6.0] - 2026-09-24

### Added

- **Připomínky ostatních.** Nápady, vzhled, mobil a jiné se po odeslání hned ukážou všem v nové kartě na stránce Připomínky, bez jména. Kdokoli jim může dát 👍 nebo 👎; druhý klik na stejný palec hlas vezme zpět, klik na druhý palec ho změní. Řazení „Nejnovější“ / „Nejlepší“ (👍 mínus 👎), dlouhý text se rozbalí. U vlastních připomínek (podle „Moje připomínky“ v prohlížeči) se místo palců ukáže „Tvoje“. Chyby, jídlo a pochvaly dál vidí jen správce. Veřejně jde jen text, kategorie, stav a datum — nikdy stránka, zařízení, technický údaj, screenshoty ani poznámka správce.
- **Vlastní návrh do „Co chystáme“.** V Nastavení → Připomínky tlačítko „Vlastní návrh k hlasování“: správce napíše nápad a lidé na něj dají 👍 nebo 👎. Návrh je k hlasování, dokud není Hotovo nebo Zamítnuto. U „Co chystáme“ je tenký proužek s podílem 👍.
- **Skrytí z veřejného seznamu** u každé veřejné připomínky i návrhu (nevhodný text, duplicita). Ze stránky zmizí i s hlasováním, v Nastavení zůstane. Upozornění na Telegramu nově říká, jestli připomínku hned vidí i ostatní.
- Animace u hlasování: palec po kliknutí krátce „cvrnkne“, číslo přijede zespodu, a když se kvůli hlasům změní pořadí v „Co chystáme“ nebo se přepne řazení, položky se na nové místo plynule přesunou (FLIP, s krátkým zpožděním, ať tlačítko neuteče zpod prstu). Rozbalení dlouhého textu plynule změní výšku. Při `prefers-reduced-motion` bez pohybu.
- **Předání připomínky k řešení** (Nastavení → Připomínky, v detailu připomínky):
  - „Zkopírovat pro AI“ dá do schránky hotové zadání pro Claude Code nebo Codex: kategorii, stav, stránku, zařízení, verzi aplikace, technický údaj, počet screenshotů, text, interní poznámku a pokyny k postupu (AGENTS.md, SemVer, CHANGELOG, nerozbít objednávky/PDF/e-mail). Na `http://` bez HTTPS, kde prohlížeč `navigator.clipboard` nepovolí, se kopíruje záložní cestou; když neprojde ani ta, zobrazí se text k ručnímu zkopírování.
  - „Založit úkol na GitHubu“ otevře předvyplněný nový issue. Nic se neodešle samo, GitHub formulář ukáže text k úpravě. Adresa se drží pod 7 500 znaky, delší text připomínky se zkrátí.
  - Interní poznámka jde jen do schránky, na veřejný GitHub ne. Screenshoty je potřeba přiložit ručně.
  - **Číslo úkolu se doplní samo.** Úkol nese neviditelnou značku (HTML komentář s id a časem připomínky). Po otevření záložky Připomínky a po každém návratu do okna appka přečte posledních 100 úkolů z GitHub API a k připomínce zapíše číslo a stav (otevřený/uzavřený). V seznamu je pak „úkol #15“ a v detailu odkaz místo „Založit úkol“; u uzavřeného úkolu připomene, že je čas označit připomínku jako Hotovo a odpovědět. Bez tokenu (repozitář je veřejný), nejvýš jednou za 90 s, při vyčerpaném limitu GitHubu počká na jeho obnovení a chyby sítě Nastavení neshodí. Páruje se jen úkol od vlastníka nebo spolupracovníka repozitáře se shodným id i časem připomínky a už spárovaný úkol se nepřepíše jiným. Pro soukromý repozitář jde nastavit env `GITHUB_TOKEN`; při odmítnutém tokenu se to zkusí bez něj.
- **Stažení screenshotů** u připomínky v Nastavení („Stáhnout“ / „Stáhnout vše“). Prohlížeč je převede z WebP do PNG (`pripominka-42-1.png`), aby šly rovnou přetáhnout do úkolu na GitHubu nebo do AI.
- Testy: `lib/feedback-export.test.ts` (zadání, odkaz, značka), `tools/feedback.test.mjs` (párování s úkoly; Připomínky ostatních jen s veřejnými kategoriemi a bez citlivých polí; návrhy správce; 👍/👎 a změna hlasu) a `app/api/feedback/route.test.ts` (hlasování 👍/👎, skrytá připomínka, neplatné hodnoty).

### Changed

- **Připomínky jsou anonymní.** Z formuláře zmizel výběr podpisu i předvyplnění jména z objednávky; server jméno nepřijme ani neuloží. Kdo chce, podepíše se do textu. Formulář pod textem říká, jestli připomínku uvidí i ostatní, nebo jen správce.
- **Hlasování má 👍 i 👎** (dřív jen „chci taky“). „Co chystáme“ se řadí podle 👍 mínus 👎. `POST /api/feedback/vote` přijímá `value: 1 | -1 | 0` a vrací `{ up, down }`. Dřívější hlasy zůstávají jako 👍; seznam vlastních hlasů v prohlížeči se převede sám.
- Připomínka dána do „Co chystáme“ (přepínač „Dát do Co chystáme“) z Připomínek ostatních zmizí a hlasy si vezme s sebou.

### Fixed

- **Obnova ze zálohy vrací připomínky celé.** Dřív obnovila jen text, kategorii, stav, poznámku a odpověď — skrytá připomínka by se po obnově znovu ukázala na veřejné nástěnce, návrh správce by se změnil v obyčejnou připomínku a ztratila by se čísla úkolů na GitHubu. Nově se obnoví i skrytí, „Co chystáme“, verze appky, technický údaj, kód pro „Moje připomínky“ a úkol na GitHubu. Záloha nově obsahuje i hlasy (`feedback_votes`, jen otisk kódu prohlížeče) a obnova je přiřadí ke správným připomínkám; opakovaná obnova nic nezdvojí. Test `app/api/restore/route.test.ts` (záloha → smazání → obnova).

### Security

- **Odemčení Nastavení počítá jen špatné PINy.** Obrazovka s PINem měla vlastní limit 5 pokusů za 10 minut, který počítal i správná odemčení — správce se tak po pěti otevřeních Nastavení zamkl sám. Nově používá stejný zámek jako Server Actions a API routy (`checkSettingsPinAttempt()` v `lib/api-auth.ts`): 10 špatných PINů z jedné adresy = zámek na 15 minut, sdílený pro celou appku, a obrazovka dál odpočítává zbývající čas. Test v `tools/feedback.test.mjs`.
- **IP návštěvníka za Cloudflarem.** Rate limity a zámek PINu braly první položku `X-Forwarded-For`, kterou si návštěvník vyplní sám (Cloudflare i Next.js k ní jen připisují) — s jinou vymyšlenou adresou u každého pokusu šel zámek PINu po 10 chybách i limity připomínek obejít. Nově `getClientIpFromHeaders()` v `lib/api-auth.ts` bere `CF-Connecting-IP`, kterou nastavuje Cloudflare a podvrhnout nejde (Cloudflare Tunnel ji doporučuje přesně k tomu), a bez Cloudflaru poslední položku `X-Forwarded-For`. Platí pro všechna místa: Server Actions, odemčení Nastavení, připomínky, hlasování, záloha, SMTP test, import PDF. Test `lib/client-ip.test.ts`.

### Migration notes

- Databáze se rozšíří sama při startu o sloupce `feedback.hidden`, `feedback.is_proposal` a `feedback_votes.value` (výchozí 1 = 👍). Sloupec `feedback.author_name` zůstává kvůli starším zálohám, nové připomínky ho nechávají prázdný.

- Databáze se rozšíří sama při startu o sloupce `feedback.github_issue` a `feedback.github_issue_state`. Zpětně kompatibilní, bez ručního kroku.
- Kontejner potřebuje odchozí HTTPS na `api.github.com` (jen pro párování úkolů; bez něj vše ostatní funguje dál).

## [1.5.0] - 2026-09-24

### Added

- **„Co je nového“ na stránce Připomínky.** Karta ukazuje poslední novinku i lidem, kteří nemají PIN do Nastavení; „Starší novinky“ otevře okno s celou historií (stejné jako „Co je nového“ v Nastavení). Okno se vykresluje přes portál do `<body>`, protože `backdrop-filter` karty by jinak z `position: fixed` udělal pozici vůči kartě.
- Záznam v `lib/release-notes.ts` má nové povinné pole `forEveryone`: pár neosobních vět o tom, čeho si všimne člověk, který si objednává. Správa, zabezpečení a nasazení tam nepatří a dál se ukazují jen v Nastavení → O aplikaci → Novinky. Verze s prázdným `forEveryone` se veřejně nezobrazí. Doplněno zpětně pro 1.2.0 až 1.4.0; samotná 1.5.0 veřejně nic neohlašuje (karta by ohlašovala sama sebe).
- Testy: veřejné novinky nevynechají nevydanou verzi, nepustí ven technické sekce a neoslovují čtenáře („vy“ ani „ty“, protože stránka Připomínky tyká a zbytek appky vyká).

## [1.4.0] - 2026-09-24

### Added

- **Připomínky k aplikaci.** Nová stránka `/pripominky` (v menu „Připomínky“, na mobilu „Nápady“), kam lidé píšou nápady, chyby, výtky i pochvaly. Kategorie se vybírá emoji dlaždicí (💡 nápad, 🐞 chyba, 🍽️ jídlo, 🎨 vzhled, 📱 mobil, 🙌 pochvala, 💬 jiné); teprve pak se ukáže otázka ušitá na kategorii, rychlé začátky vět na klik a pole, které roste s textem. Podpis jménem (předvyplní se z posledního objednávání), nebo bez jména. Rozepsaný text se průběžně ukládá v prohlížeči a po odchodu ze stránky se neztratí. Odeslání i přes Ctrl+Enter. Automaticky se přidá jen stránka, odkud člověk přišel, a hrubý typ zařízení (mobil/počítač).
- **Moje připomínky.** Kdo pošle připomínku, vidí na stránce její stav (Čeká na přečtení, Přečteno, V plánu, Hotovo, Nebude se dělat) a odpověď správce. Bez účtů: server při odeslání vrátí náhodný tajný kód (192 bitů), prohlížeč si ho uloží do localStorage a stav si žádá přes `POST /api/feedback/mine`. V databázi je jen SHA-256 kódu a porovnává se v konstantním čase. Seznam platí jen pro daný prohlížeč.
- **„Nahlásit problém“ tam, kde problém vzniká.** Chybová stránka appky má tlačítko, které otevře připomínky s předvyplněnou kategorií Chyba, stránkou a kódem chyby (digest z Next.js, dohledatelný v logu serveru). Technický údaj uživatel vidí a může ho před odesláním odebrat. V nápovědě objednávky přibyl odkaz „Něco nefunguje? Napište nám“.
- U připomínky se ukládá verze appky, kterou měl autor načtenou. Správce ji vidí v Nastavení i v upozornění na Telegramu.
- Screenshoty vyřízených připomínek (Hotovo, Zamítnuto) se 90 dní po poslední změně stavu samy smažou (scheduler, denně ve 3:30). Text připomínky zůstává.
- **Hlasování „chci taky“.** Správce dá otevřené připomínce krátký název (např. „Tmavý režim“) a zapne „Dát k hlasování“. Název se ukáže v kartě „Co chystáme“ a lidé u něj dávají 👍; nejžádanější jsou nahoře. Text autora ani odpověď autorovi se v hlasování neukazují. Hotové a zamítnuté připomínky se z hlasování samy stáhnou a počet hlasů se ukáže v seznamu změn. Jeden hlas na prohlížeč hlídá databáze (`feedback_votes`, primární klíč připomínka + otisk kódu prohlížeče); kdo si smaže data prohlížeče, může hlasovat znovu, proto jsou počty orientační.
- **Pozvánka k připomínkám na objednávkové stránce.** Pod stavovým pruhem je banner ve stejném stylu s odkazem na stránku Připomínky. Při každém otevření stránky je jiná z 30 vět, nikdy stejná dvakrát po sobě („Stížnosti na knedlíky řeš s kuchyní. Stížnosti na appku s námi.“). Křížkem jde skrýt na 14 dní.
- **Screenshoty k připomínce** (nejvýš 3). Obrázek jde přetáhnout kamkoli na stránku, vložit přes Ctrl+V nebo vybrat souborem (na mobilu i z galerie). Prohlížeč ho před odesláním zmenší. Obrázek přetažený ještě před výběrem kategorie ji předvybere jako „Chyba“. Správce je vidí u připomínky v Nastavení a může je zvětšit; v upozornění na Telegramu je jen jejich počet.
- Nastavení → **Připomínky** (za PINem): velká čísla K vyřízení / Nové / V plánu / Hotovo / Vše zároveň filtrují seznam. Stav (Nová, Přečteno, V plánu, Hotovo, Zamítnuto) se mění jedním klikem a projeví se hned; rozkliknutím se nová připomínka označí jako přečtená. K tomu interní poznámka, odpověď (autor ji vidí hned, ostatní u stavu Hotovo) a mazání. Počet nových ukazuje odznak u záložky.
- Seznam „Změnili jsme díky vám“ na stránce Připomínky. Obsahuje jen připomínky ve stavu Hotovo s vyplněnou veřejnou odpovědí a ukazuje výhradně tu odpověď — původní text ani autor se veřejně nikdy nezobrazí.
- Telegram: upozornění na novou připomínku. Posílá se **jen adminům bota** a jen těm, kdo si ho sami zapnou v `/nastaveni` → 💬 Nové připomínky. Ve výchozím stavu je vypnuté; běžným uživatelům se přepínač nenabízí a webhook ho od nich nepřijme ani při podvrženém `callback_data`.
- Záloha (`/api/backup`) a obnova (`/api/restore`) zahrnují připomínky; obnova přeskakuje ty, které už v databázi jsou (stejný čas i text).
- Testy: `lib/feedback.test.ts` (validace, text pro Telegram), `app/components/feedback/feedback-utils.test.ts` (koncept, začátky vět, datum, zmenšování obrázků, úložiště kódů), `app/api/feedback/route.test.ts` (API: limity, podvržené soubory, past na roboty, rate limit, tajné kódy) a `tools/feedback.test.mjs` (proti dočasné SQLite: přílohy, úklid, veřejný seznam, Telegram jen pro adminy).

### Changed

- Texty v celé aplikaci prošly jazykovou kontrolou podle Internetové jazykové příručky ÚJČ. Aplikace uživatelům jednotně vyká (dřív se střídalo tykání s vykáním); tykání zůstává záměrně jen na stránce Připomínky, v pozvánce k připomínkám a v Telegram botovi.
- LIMA se skloňuje („do LIMY“, „v LIMĚ“), v souvislém textu je „jídelníček“ místo „menu“ a „e-mail“ místo „mail“.
- Jednotná typografie: pomlčka „ – “ místo „ — “, výpustka „…“ místo tří teček, české uvozovky „ “.

### Fixed

- Skloňování počtů: „1 objednávka / 3 objednávky / 5 objednávek“, „zbývají 3 minuty“ apod. místo tvarů typu „3 objednávek“ nebo „položek: 1“ (nové pomocné funkce `plural()`, `countWord()` a `remainingMinutes()` v `lib/format.ts`).
- Příští automatické odeslání se píše s předložkou ve správném tvaru („Ve středu v 10:30“, ne „V středu“).
- Chybějící čárky ve vedlejších větách a před vylučovacím „nebo“, překlepy a doslovné anglicismy v Nastavení, nápovědě a zprávách bota.
- Patička e-mailu objednávky: „STROS – Sedlčanské strojírny, a.s.“ (jen pomlčka, obsah e-mailu i PDF příloh je jinak beze změny).

### Security

- Formulář je veřejný, proto: validace na serveru přes zod (délky, povolené kategorie, odstranění řídicích znaků, stránka jen jako cesta v rámci appky), limit 5 připomínek za hodinu na IP a strop 100 za den pro celou appku (IP z `x-forwarded-for` jde podvrhnout), skryté pole proti robotům. Text se všude vykresluje jako prostý text a pro Telegram se escapuje.
- IP adresa ani celý user-agent se k připomínce neukládají.
- Screenshoty nahrává kdokoli, proto se nevěří příponě ani Content-Type: každý soubor dekóduje `sharp`, co není PNG/JPEG/WebP/GIF, neprojde (ověřeno i na HTML s hlavičkou PNG a na SVG se skriptem). Obrázek se znovu zakóduje do WebP, takže zmizí EXIF (poloha, model telefonu) i cokoli přilepeného za obrazová data. Omezení: 10 MB na soubor, 40 Mpx, delší strana po zpracování 2000 px, 500 MB pro všechny přílohy dohromady. Soubory mají náhodné jméno (UUID) a stahují se jen s PINem přes `/api/feedback/attachments/[id]`, s `Content-Security-Policy: sandbox`, `nosniff` a `no-store`.
- Připomínky se odesílají přes `POST /api/feedback` (multipart) místo Server Action, protože ty mají strop těla 1 MB. Routa odmítne požadavek bez `Content-Length` nebo větší než limit ještě před čtením těla.
- Hlasování: `POST /api/feedback/vote` přijme hlas jen u zveřejněné otevřené připomínky, kód prohlížeče se ukládá jen jako SHA-256 a IP se neukládá. Limit 200 hlasů za hodinu na IP je záměrně velkorysý, protože celá firma často chodí ven přes jednu adresu; zastaví skript, ne kolegy.
- Čtení, úprava i mazání připomínek ověřují PIN v každé Server Action zvlášť a sdílejí počítadlo neúspěchů s chráněnými API routami (10 chyb z jedné IP = zámek na 15 minut). Kontrola PINu se zámkem je nově v `verifySettingsPin()` v `lib/api-auth.ts`; `requireSettingsPin()` ji používá beze změny chování.

### Migration notes

- `sharp` je nově přímá závislost (dřív jen nepřímá přes Next.js), verze se nemění.
- Screenshoty se ukládají do `data/feedback-attachments/` vedle databáze, tedy do stejného Docker volume. Nic nastavovat netřeba.
- Databáze se rozšíří automaticky při startu: nové tabulky `feedback` (včetně sloupců `secret_hash`, `context`, `app_version`, `status_changed_at`, `votable`, `vote_title`), `feedback_attachments` a `feedback_votes` a sloupec `telegram_subscriptions.notify_feedback` (výchozí 0). Změna je zpětně kompatibilní, žádný ruční krok není potřeba.

### Known issues

- Hlasování je orientační: hlas patří prohlížeči, ne člověku. Bez přihlašování to jinak nejde.
- JSON záloha (`/api/backup`) obsahuje text připomínek, ale ne screenshoty ani hlasy. Při přenosu na jiný server je potřeba zkopírovat i složku `data/feedback-attachments/` (je ve stejném volume jako databáze).

## [1.3.4] - 2026-08-25

### Fixed

- Okno „Co je nového“ v Nastavení ukazovalo naposledy verzi 1.3.1, přestože aplikace běžela na 1.3.3. Novinky v aplikaci žijí v `lib/release-notes.ts` a píšou se ručně, zvlášť od `CHANGELOG.md` — ten je technický, novinky jsou pro lidi. Při vydání 1.3.2 a 1.3.3 se na ně zapomnělo; obě verze jsou doplněné.

### Added

- `lib/release-notes.test.ts` — pět testů, které z novinek dělají podmínku vydání. Klíčový je ten, který porovnává první záznam s verzí v `package.json`: bez novinek k aktuální verzi neprojde CI, takže se stejná chyba nemůže zopakovat. Ostatní hlídají prázdné sekce, duplicitní nadpisy a tvar data.

## [1.3.3] - 2026-08-25

### Security

- **Stažení celé databáze bylo veřejné.** `GET /api/backup` vracel všechny objednávky, jména lidí, jídelníčky, oddělení i nastavení komukoli, kdo znal adresu — chránil ho jen limit 5 požadavků za hodinu na IP. Aplikace je přitom vystavená na veřejnou adresu, takže „chrání nás firemní síť“ nikdy neplatilo. Nově vyžaduje PIN z Nastavení.
- **Zápis do databáze byl veřejný a zcela bez ochrany.** `POST /api/restore` neměl ani rate limit. Přidávat cizí objednávky, jídelníčky a oddělení mohl kdokoli. PIN v nastavení přepsat nešlo, protože obnova používá `INSERT OR IGNORE`. Nově vyžaduje PIN.
- **Záloha vydávala přístupové údaje k botovi.** Filtr citlivých klíčů vynechával `telegramBotToken` a `telegramWebhookSecret`. Se získaným tokenem šlo bota převzít — číst zprávy odběratelů i psát jim. Oba klíče se nově filtrují. **Doporučené opatření: token u @BotFather zrotovat**, protože žádná oprava kódu zpětně nezneplatní token, který už mohl uniknout.
- `POST /api/smtp-test` navazoval odchozí spojení podle těla požadavku bez ověření. Nově vyžaduje PIN.
- Neúspěšné pokusy o PIN u API se počítají zvlášť: po deseti chybách z jedné IP se brána zavře na 15 minut i pro správný PIN. Povedené pokusy se nepočítají, aby si běžné používání samo nezamklo Nastavení.
- Záloha se stahuje přes `fetch` a blob místo prostého odkazu — PIN putuje v hlavičce a nekončí v historii prohlížeče ani v logu proxy.

### Known issues

- **Objednávková stránka zůstává veřejná.** Kdokoli s adresou vidí, kdo si co objednal, a může objednávky měnit; totéž platí pro `/api/order-refresh` a `/api/sse`. PINem to zalepit nejde — vyřeší to až účty a přihlašování, které se připravují samostatně.

### Added

- CI spouští `npm run lint` a `npm test` a publikace Docker image na nich závisí. Do té doby byla jedinou kontrolou mezi commitem a tagem `stable` jen úspěšná kompilace uvnitř Dockerfilu, která chytí chyby typů, ale ne rozbité chování. Testy běží i u pull requestů.
- `tools/api-auth.test.mjs` — šest testů brány chráněných rout. Hlídají mimo jiné to, že třicet povedených volání za sebou zámek nespustí a že se zámek počítá na IP, ne globálně.

## [1.3.2] - 2026-08-24

### Fixed

- V záhlaví objednávky svítilo datum dneška i po přepnutí na jiný den. Nejčastěji to nastalo samo od sebe: po uzávěrce appka přeskočí na zítřek, čip v pásku dnů říkal „Zítra“, ale nadpis pořád „Pondělí 24. 8.“ — člověk pak upravoval jiný den, než si myslel. Nově se datum odvozuje z vybraného dne. Spolu s tím se opravilo, že „úterý“ a „čtvrtek“ zůstávaly s malým písmenem, protože převod prvního znaku uměl jen ASCII.
- „Přidat“ v jídelníčku zapisovalo položku do databáze hned a teprve pak otevřelo dialog. Zavření bez vyplnění tak v jídelníčku nechalo řádek bez názvu — počítal se do souhrnu dne a přes SSE se rozeslal ostatním. Nově se položka zakládá až uložením; dialog rozepsané položky nenabízí mazání a bez názvu nejde uložit.
- Když se objednávka po uzávěrce znovu otevřela, uzávěrka se ten den už nikdy nezapnula — příznak odemčení nesl jen datum, takže přenastavení času uzávěrky nemělo kam zabrat. Nově se pamatuje i čas odemčení a platí pravidlo „odemčení promíjí jen tu uzávěrku, která už proběhla". Odemčeno v 8:05 a uzávěrka přesunutá na 8:10 tedy v 8:10 zase zamkne; odemčení předtím platné uzávěrky se nemění.
- Po odemčení appka dál hlásila „Po uzávěrce (08:00)" a v panelu „Objednávky uzavřeny", i když objednávat šlo. Nově ukazuje „Objednávání odemčeno" s tím, kdy se objednávka odešle.
- Odpočet do uzávěrky v záhlaví se po přepnutí z budoucího dne zpět na dnešek aktualizoval až s dalším tikem hodin, tedy až půl minuty ukazoval nesprávnou hodnotu. Nově se přepočítá okamžitě.
- Dialog pro odemčení sliboval otevření objednávek „na zbytek dne". To po opravě uzávěrky neplatí — když se čas uzávěrky posune dál, zase začne platit. Text to teď říká.

### Added

- `npm test` — vitest nad `app/` a `lib/` plus dosavadní `node --test` nad `tools/`. Přibyly testy vyhodnocení uzávěrky (`tools/cutoff.test.mjs`) a odesílací cesty objednávky (`tools/orders-send.test.mjs`) proti dočasné SQLite a falešnému SMTP serveru. Pokrývají dvojí odeslání, návrat na draft při chybě SMTP, chování „Znovu odeslat email" i přepis archivovaného PDF.

### Changed

- Interně: dokončen rozpad velkých komponent do doménových složek — `SettingsPage` 2147 → 358 řádků, `MenuPage` 1159 → 265, `DepartmentPanel` 867 → 173, `OrderPage` 1076 → 712, `HistoryPage` 238 → 135 a `OrderDetailPage` 245 → 154. Vzniklo 43 souborů v `app/components/menu/`, `settings/`, `order/`, `history/` a `order-detail/`; cesty i názvy se kryjí s větví `feat/heroui-migration`, aby se obě verze daly sloučit bez konfliktů. Sekce nastavení si nově drží vlastní stav i `useTransition`, takže test SMTP, kontrola schránky a testovací push na sobě nezávisí. Chování zůstává beze změny; ověřeno proklikáním jídelníčku, objednávky, historie i všech šesti záložek nastavení včetně ukládání formuláře ze zavřené záložky.
- Interně: z objednávkové obrazovky zmizel příznak `isReadOnly`, který byl natvrdo `false`, takže podmínka `!isReadOnly && editMode` byla vždy jen `editMode`.
- Interně: Nastavení má konstanty a pomocné funkce v `app/components/settings/`. Ukládání se řídí tabulkou polí místo ručního výčtu 41 hodnot, takže nově přidané nastavení nejde zapomenout zapojit. Chování zůstává beze změny, přibylo 12 testů — jeden z nich hlídá, že každé pole patří právě do jedné kategorie.
- Interně: přehled historie má filtrování, počty a formátování v `app/components/history/history-utils.ts`. Obědy i pizza se popisují jedním tvarem záznamu, takže filtr „skrýt prázdné koncepty", hledání i odkaz na detail existují jednou místo dvakrát. Chování zůstává beze změny, přibylo 6 testů.
- Interně: detail historické objednávky má logiku v `app/components/order-detail/order-detail-utils.ts` a společné formátování v `lib/format.ts`. `getInitials` a skloňování počtu objednávek byly do té doby ve dvou komponentách zvlášť, pravidlo pro zobrazení řádku dokonce dvakrát v jednom souboru. Chování zůstává beze změny, přibylo 18 testů.
- Interně: z `OrderPage.tsx` se vydělilo šest hooků do `app/components/order/` — `useOrderSync` (živá synchronizace přes SSE), `useDayNavigation` (přepínání dnů páskem i šipkami), `useRowDeletion` (mazání s pětivteřinovým oknem na vrácení) a `usePushNotifications`, `useCutoff` (uzávěrka a odpočet) a `useCutoffUnlock` (odemčení na PIN). Komponenta klesla z 1 466 na 1 076 řádků. Chování zůstává beze změny; ověřeno proklikáním přidání, mazání i přepínání dnů.
- Interně: pomocné funkce objednávkové obrazovky (práce s daty, sestavení přepínače dnů, přepočet oddělení) se přesunuly z `OrderPage.tsx` do `app/components/order/order-utils.ts`. Těla funkcí jsou beze změny — jde o přesun, ne přepis. `OrderPage.tsx` je o 124 řádků kratší a na funkce nově dosáhne 36 testů. Umístění i názvy odpovídají větvi `feat/heroui-migration`, aby se obě verze strukturálně sbíhaly.
- Interně: `sendOrder()` a `resendOrderEmail()` sdílí přípravu e-mailu a jeho odeslání s archivací. Dřív obě funkce opakovaly stejných dvanáct kroků, což byl důvod, proč jedné z nich chyběl zápis do archivu. Chování obou zůstává beze změny.

### Migration notes

- Žádné ruční kroky. Databáze, env proměnné, Docker konfigurace, volume ani formát záloh se nemění — změny se týkají výhradně `app/components/`, soubory `lib/`, `app/api/`, `app/actions.ts` a `Dockerfile` zůstávají beze změny.
- Rollback: nasadit zpět tag `1.3.1`. Databáze je zpětně kompatibilní, není co migrovat.

### Known issues

- Testovací tlačítka v Nastavení (test SMTP, testovací push, testovací zpráva Telegramu) a obnova ze zálohy nebyly při ověřování této verze spuštěné, protože posílají ven nebo zapisují do dat. Kód pod nimi se v této verzi nemění.

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
