# Protokol UI vrstvy účtů — k prověření

Průběžný zápis toho, co na větvi `feat/ucty-ui` vzniklo a **proč tak**. Slouží
k nezávislé kontrole: protějšek `docs/handoff-ucty-backend.md`, jen z druhé
strany. Backend v `lib/auth/**` je hotový a otestovaný, tenhle dokument popisuje
jeho zapojení do aplikace.

Větev vychází z `feat/ucty-backend` (`de10e08`). Nic není pushnuté.
20 commitů, 27 nových souborů.

```bash
git log --oneline de10e08..feat/ucty-ui
git diff de10e08..feat/ucty-ui
```

---

## Jak to prověřit

Nejdřív stav, pak úsudek.

```bash
npm ci                 # dev server musí být zastavený — drží lightningcss
npm run lint           # čistě, bez warningů
npx tsc --noEmit        # chyby v tools/gravityui-reference-mcp/** jsou cizí a existující
npm test               # 88 Vitest + 122 node:test
npm run build
npm audit              # 0 zranitelností
```

Poté v tomhle pořadí:

1. **Oddíl „Na co se dívat kriticky“ níže** — osm míst, kde jsem rozhodoval.
   U každého je napísané, co u něj ověřit. **Bod 6 (PIN) je nejrizikovější.**
2. **`tools/actions-guard.test.mjs`** — statický test, že žádná server action
   nezůstala bez kontroly. Klíčové je prověřit **seznam `PUBLIC_ACTIONS`**
   (11 položek): patří tam každá z nich?
3. **`lib/auth/policy.ts` a `lib/auth/pin-gate.ts`** — celá moje pravidlová
   vrstva nad backendem. Dohromady ani ne 150 řádků.
4. **`app/actions.ts` a `app/actions-auth.ts`** — 67 akcí, u každé zkontrolovat,
   že kontrola sedí před zápisem a odpovídá tabulce oprávnění.
5. **Známá omezení** na konci — věci, které vědomě hotové nejsou.

Backend v `lib/auth/**` je hotový a otestovaný; měnil se jediným commitem
(`548fe85`), který je popsán níže.

---

## Na co se dívat kriticky

Seznam míst, kde jsem rozhodoval a kde se dá rozhodnout jinak. Pro recenzenta
je to nejužitečnější část dokumentu.

### 1. Předúčtový režim — `lib/auth/policy.ts`

Dokud v databázi není žádný **aktivní správce**, guardy mlčí a aplikace se chová
jako před účty.

**Proč:** bez toho by nasazení bez nastavených `ADMIN_EMAIL` a `ADMIN_PASSWORD`
zamklo objednávky i Nastavení a dovnitř by se nedostal nikdo. Aplikace běží
v produkci; upgrade ji nesmí zabít.

**Proč to nejsou zadní vrátka:** přechod je jednosměrný. `setUserStatus`,
`setUserRole` i `deleteUser` odmítají odebrat posledního aktivního správce, takže
stav „žádný správce" už nikdy nenastane. Výsledek se proto memoizuje.

**Co prověřit:** je ta jednosměrnost opravdu úplná? Existuje cesta, jak přijít
o posledního správce (přímý zásah do databáze, obnova ze zálohy)? Pokud ano,
memoizace by fail-closed držela zamčeno až do restartu — což je bezpečný směr,
ale aplikaci by to zablokovalo.

### 2. Nepřivlastněný řádek — `assertMayEditRow`

Řádek s `person_id IS NULL` smí upravit **kdokoli přihlášený**.

**Proč:** nový řádek vzniká prázdný a strávníka dostane až vyplněním jména.
`assertCanEditRow` z backendu ho odmítá, takže by ho nemohl upravit ani ten, kdo
si ho právě založil — objednat by nešlo vůbec.

**Co prověřit:** je to přijatelné? Přihlášený kolega může vyplnit cizí prázdný
řádek — ale jen **vlastním jménem** (`assertNameIsOwn`), takže si ho tím
přivlastní. Škoda je nulová, ale je to výjimka z „zamítni ve výchozím stavu"
a stojí za druhý pohled.

### 3. Jméno v řádku už není volný text — `assertNameIsOwn`

Nesprávce smí zapsat jen jméno strávníka ze svého `session.personIds`.

**Proč:** R8 říká, že uživatel mění jen svoje. Volné jméno by přes
`findOrCreatePerson` založilo strávníka, za kterého objednávat nesmí — a ten
řádek by pak nemohl upravit ani on sám.

**Co prověřit:** porovnává se **přesná shoda po trimu**. Diakritika ani velikost
písmen se neignorují. Je to schválně (přísnější), ale znamená to, že UI musí
posílat jméno přesně tak, jak je v `people.name`. Až vznikne přepínač
„objednávám za:", musí posílat vybranou hodnotu, ne to, co si člověk napíše.

### 4. Skrývání ovládacích prvků

Nepřihlášený nevidí „Přidat", „Odeslat", úpravy jídelníčku ani Nastavení.

**Proč:** tlačítko, které vždycky selže, je horší než žádné. Původní hláška
„Nepodařilo se přidat řádek, zkuste to znovu" byla navíc zavádějící —
opakování nikdy nepomohlo.

**Co prověřit:** skrytí je **pohodlí, ne ochrana**. Ochranou jsou guardy
u server actions. Recenzent by měl ověřit, že žádná kontrola nestojí jen na
skrytém prvku — k tomu slouží `tools/actions-guard.test.mjs`.

### 5. Správa účtů obchází předúčtový režim

Akce v `app/actions.ts` pod hlavičkou „Účty (administrace)" se drží
`requireAdmin()`, ne `guardAdmin()`.

**Proč:** kdyby platil předúčtový režim, mohl by se v databázi bez správce
kdokoli povýšit na správce — a tím z toho režimu natrvalo vystoupit. To je
jediná skupina akcí, která z něj umí vystoupit, takže musí být výjimkou.

**Co prověřit:** je výčet úplný? Existuje jiná akce, která umí změnit roli
nebo založit správce a je zajištěná jen `guardAdmin()`?

### 6. PIN zůstává zadními vrátky do Nastavení — **vědomá odchylka od R12**

Správný PIN otevře Nastavení i bez přihlášení. R12 přitom říkalo, že PIN má
být až druhým krokem, ne obchvatem účtů.

**Proč přesto:** kdyby se přihlašování rozbilo, je to jediná cesta zpět — a bez
Nastavení nejde spravit ani SMTP, přes které se obnovuje heslo. Bez vrátek by
šla aplikace zamknout tak, že by nešla odemknout. Rozhodnutí majitele, dočasné
na dobu zkoušení.

**Jak to funguje:** správný PIN vydá krátkodobý podepsaný doklad (30 minut,
HttpOnly), který `guardAdmin()` uznává vedle správcovského sezení. Není to
sezení — nenese uživatele a mimo Nastavení neplatí.

**Co prověřit — tohle je nejrizikovější místo celé větve:**

- Čtyřmístný PIN při pěti pokusech za deset minut vydrží ~14 dní hádání.
  Kdo se dostane do Nastavení, stáhne si `/api/backup` s celou databází.
  **Doporučení: před nasazením změnit PIN z výchozího `1234` a prodloužit ho.**
- Neměl by limit být přísnější, když už PIN otevírá víc než dřív?
- Stálo by za to zapnout vrátka jen při chybějícím správci, ne trvale?
- Vstup mimo správcovský účet se zapisuje jako `settings_pin_bypass` — sleduje
  to někdo?

### 7. Jméno v řádku je pro nesprávce výběr

Nesprávce nevyplňuje křestní a příjmení, ale vybírá z `AccountView.orderableNames`.
Při jediném jménu se jen vypíše.

**Proč:** server porovnává přesnou shodu (viz bod 3). Dokud bylo pole volný
text, stačil chybějící háček a zápis skončil odmítnutím, kterému by člověk
nerozuměl — vlastní jméno by musel trefit znak po znaku.

**Co prověřit:** `orderableNames` obsahuje jména všech `session.personIds`.
Aktivní host má vlastní účet, takže se v seznamu hostitele **neobjeví** —
objednává si sám. Pasivní host (člověk bez účtu, za kterého objednává někdo
jiný) zatím nejde založit — viz známá omezení.

### 8. Rozpočet pokusů u registrace

15 registrací za hodinu na IP, odečítá se **až skutečně založený účet**.

**Proč:** kolegové v kanceláři sdílejí jednu veřejnou IP. Přísnější číslo by
zablokovalo tým, ne bota — ten dělá stovky pokusů. Mezikrok „nejsi to ty?"
žádný účet nezakládá, takže nemá co odečítat.

**Co prověřit:** je 15/hod správně? A je v pořádku, že mezikrok je nelimitovaný
(chráněný jen `isRateLimited`)? Je to oracle na jména strávníků — ta jsou ale
veřejná na objednávkové stránce, takže se nic nového neprozrazuje.

---

## Co bylo opraveno v backendu

Podle zadání: nalezené integrační problémy doložit testem a opravit odděleným
minimálním commitem.

### `548fe85` — pozůstalé tabulky ze starého pokusu o přihlašování

**Nález:** aplikace se po zapojení nenačetla vůbec. Ve vývojové databázi byly
tabulky `users` a `sessions` z větví `v2-auth-*` v jiném tvaru. Protože se
zakládají přes `CREATE TABLE IF NOT EXISTS`, migrace je tiše nechala být a první
dotaz spadl na `no such column: name`. Sezení čte kořenový layout, takže
nespadlo jen přihlašování, ale **každá stránka**.

Testy to nenašly, protože běží nad čistě založenou databází.

**Oprava:** migrace staré tabulky odloží do `*_legacy_v2` a nic nemaže. Pořadí
řídí cizí klíče: nejdřív `sessions` a `password_reset_tokens`, až potom `users`.
Starý pokus navíc přidal do `order_rows` a `pizza_order_rows` sloupec `user_id`
s vazbou na účty — hodnota se uvolňuje, ale dvojice `(id, user_id)` se schová do
`*_user_legacy_v2`, aby šlo dohledat, kdo řádek založil.

Kopie přes `CREATE TABLE AS SELECT` je schválně bez omezení: `ALTER TABLE RENAME`
by přepsal cizí klíče v ostatních tabulkách na nový název.

**Co prověřit:** týká se to i produkční databáze? Kontrola:

```bash
docker exec stros-objednavky node -e "const d=require('better-sqlite3')(process.env.DB_PATH||'./data/stros.db',{readonly:true});const u=d.prepare(\"SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'\").get();console.log(u?'users existuje — zkontroluj tvar':'čisté')"
```

Ověřeno proti skutečné vývojové databázi: 2 staré účty, 3 sezení a 1 odkaz
z objednávky odloženy, 16 řádků objednávek a 8 strávníků nedotčeno.

---

## Průběh po commitech

| Commit | Co |
|---|---|
| `c2b5975` | docs — `AGENTS.md` tvrdil, že není testovací framework (je, tehdy 188 testů) a že lint má ~42 chyb (prochází čistě); `CLAUDE.md` uváděl Next.js 15 místo 16 |
| `5fa45d8` | guardy na všech 47 server actions + `lib/auth/policy.ts` + statický test |
| `548fe85` | oprava migrace (viz výše) |
| `182e50e` | přihlášení, odhlášení, `AccountView` v navigaci |
| `3fe6019` | režim jen pro čtení na stránce objednávky |
| `15a89d3` | role na jídelníčku, pizze a v nastavení |
| `0805e74` | registrace s převzetím historie + ověření e-mailu |
| `0970de3` | oprava statického testu po přibytí registrace |
| `8a69030` | obnova a změna hesla |
| `c6f3a37` | přihlášená zařízení |
| `c504eda` | založení tohohle protokolu |
| `7902ac7` | pozvánky hostů a registrace z odkazu (R19, R20) |
| `105232a` | správa účtů v nastavení |
| `d4bdb5a` | doplnění tohohle protokolu |
| `c2878f1` | propojení Google účtu potvrzením hesla (R6) + stavy z callbacku |
| `acb0703` | jméno v řádku jako výběr |
| `7574dd3` | X-Robots-Tag noindex a robots.txt |
| `2155b35` | PIN jako zadní vrátka do Nastavení |
| `27940e4`, `c16b5ac` | další doplnění tohohle protokolu |

### Klasifikace server actions

67 exportovaných akcí: 53 v `app/actions.ts`, 14 v `app/actions-auth.ts`.

| Kategorie | Počet | Příklad |
|---|---|---|
| Veřejné čtení | 3 | `actionGetDepartments` |
| Veřejný vstup (přihlášení, registrace, obnova, PIN) | 8 | `actionLogin`, `actionCheckPin` |
| Jen správce | ~43 | `actionSendOrder`, `actionSaveSettings` |
| Přihlášený | ~10 | pizza řádky, sezení, pozvánky |
| Vlastnictví | 3 | řádky objednávky |

Veřejných je v testu 11 (3 čtení + 8 vstupů). **Každá z nich má v testu
komentář, proč tam je — to je místo, které stojí za nejpřísnější pohled.**

Seznam veřejných je v `tools/actions-guard.test.mjs` a doplnit se do něj dá jen
vědomě. Test byl ověřen tím, že po dočasném odebrání guardu z `actionSendOrder`
skutečně selhal a jmenoval ji.

---

## Známá omezení

1. **Pizza řádky nemají vlastnictví.** `pizza_order_rows` nemají `person_id`,
   jen `person_name`. Vynutit jde tedy jen přihlášení, ne „jen svoje". Náprava
   by chtěla migraci schématu.
2. **Odhlášení jednoho konkrétního zařízení** není v UI. Backend umí zrušit
   sezení podle tokenu nebo všechna kromě aktuálního; podle id neumí. Nabízí se
   proto „odhlásit ostatní zařízení".
3. **Nepřihlášený vidí jména kolegů** — to je záměr (R1), ne opomenutí.
   Hlavička `X-Robots-Tag: noindex` zatím nasazená není.
4. **Google tok nebyl vyzkoušený naostro** — chybí `GOOGLE_CLIENT_ID`
   a `GOOGLE_CLIENT_SECRET`. Obrazovky i směrování stavů hotové a ověřené
   ručním vyvoláním `?auth=…`, samotný průchod přes Google ne.
   **Registrace hosta přes Google chybí** — backend variantu
   `{ provider: "google", profileCookie }` umí, UI ji zatím nenabízí.
6. **Pasivního hosta nejde založit.** Člověk bez účtu, za kterého objednává
   někdo jiný, existuje ve schématu (`guest_of_person_id`), ale UI ho vytvořit
   neumí. Týká se to např. manželky, která appku nikdy neotevře.
7. **Ve vývojové databázi zůstávají testovací účty** (`spravce.test@`,
   `stravnik.test@`, `petr.test@`, `marie.test@`) a seedovaní strávníci.
   Do produkce se nedostanou — jsou jen v lokálním `data/stros.db`.
5. **Sekce Účty nebyla vizuálně proklikaná** — Nastavení jsou za PINem, který
   nezadávám. Chování pod ní ověřeno přímo (ochrana posledního správce drží
   ve všech třech směrech), vzhled ne.

---

## Jak se to ověřovalo

Každý krok: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`,
a potom **proklikání v prohlížeči** ve třech rolích (nepřihlášený, strávník,
správce). Chyby, které našlo až spuštění:

- pozůstalé tabulky (viz výše) — shodily celou aplikaci
- `Invalid Date` u sezení — auth vrstva ukládá ISO už s `Z`, doplněné `Z` bylo
  druhé v pořadí
- slepené „Safaritoto zařízení" — chyběla mezera před odznakem
- „1 objednávek" místo „1 objednávka" a datum `2026-03-04` místo `4. 3. 2026`

Žádnou z nich by testy nenašly. Proto se každý krok proklikává.

### Bezpečnostní a přístupnostní průchod

- `npm audit`: **0 zranitelností**
- `X-Robots-Tag: noindex, nofollow` na všech cestách + `robots.txt` — ověřeno
  proti běžícímu serveru
- všechna pole nových formulářů mají svázaný `<label>` a správný
  `autocomplete`; chyby jsou v `role="alert"`
- na každé obrazovce je v přístupnostním stromu právě jeden `h1` (druhý má
  rodiče `display: none` — desktopová a mobilní hlavička)
- žádný token, otisk ani obsah cookie se nedostává do klientských props;
  `AccountView` vědomě neobsahuje ani `userId`

### Rozložení

Dolní lišta na mobilu má nově až šest položek. Na 375 px se vejde celá
(357 z 357 px, poslední položka celá viditelná), na 320 px se posouvá uvnitř
sebe a **stránka vodorovně nescrolluje**.
