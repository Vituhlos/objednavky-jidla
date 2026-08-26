# Protokol UI vrstvy účtů — k prověření

Průběžný zápis toho, co na větvi `feat/ucty-ui` vzniklo a **proč tak**. Slouží
k nezávislé kontrole: protějšek `docs/handoff-ucty-backend.md`, jen z druhé
strany. Backend v `lib/auth/**` je hotový a otestovaný, tenhle dokument popisuje
jeho zapojení do aplikace.

Větev vychází z `feat/ucty-backend` (`de10e08`). Nic není pushnuté.

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

### 5. Rozpočet pokusů u registrace

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
| `c2b5975` | docs — `AGENTS.md` tvrdil, že není testovací framework (je, 188 testů) a že lint má ~42 chyb (prochází čistě); `CLAUDE.md` uváděl Next.js 15 místo 16 |
| `5fa45d8` | guardy na všech 47 server actions + `lib/auth/policy.ts` + statický test |
| `548fe85` | oprava migrace (viz výše) |
| `182e50e` | přihlášení, odhlášení, `AccountView` v navigaci |
| `3fe6019` | režim jen pro čtení na stránce objednávky |
| `15a89d3` | role na jídelníčku, pizze a v nastavení |
| `0805e74` | registrace s převzetím historie + ověření e-mailu |
| `0970de3` | oprava statického testu po přibytí registrace |
| `8a69030` | obnova a změna hesla |
| `c6f3a37` | přihlášená zařízení |

### Klasifikace server actions

47 exportovaných akcí v `app/actions.ts`, dalších pár v `app/actions-auth.ts`:

| Kategorie | Počet | Příklad |
|---|---|---|
| Veřejné čtení | 3 | `actionGetDepartments` |
| Vstup do přihlášení | 5 | `actionLogin`, `actionRegister` |
| Jen správce | 38 | `actionSendOrder`, `actionSaveSettings` |
| Přihlášený | 3 | pizza řádky |
| Vlastnictví | 3 | řádky objednávky |

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

### Rozložení

Dolní lišta na mobilu má nově až šest položek. Na 375 px se vejde celá
(357 z 357 px, poslední položka celá viditelná), na 320 px se posouvá uvnitř
sebe a **stránka vodorovně nescrolluje**.
