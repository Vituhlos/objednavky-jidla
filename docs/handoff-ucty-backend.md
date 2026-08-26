# Handoff — backend účtů a přihlašování

Zadání pro implementaci datové a pravidlové vrstvy. **Píšeš jen `lib/` a route
handlery. UI (komponenty, server actions) dělá někdo jiný po tobě** — viz
[Rozsah](#rozsah).

Kontext rozhodnutí je v samostatném zápisu; odkazy `R1`–`R20` níže na něj míří.
Vše podstatné je ale zopakované tady, takže tenhle soubor je soběstačný.

---

## 1. Co stavíš

Kantýna je firemní appka na objednávání obědů. Běží jako jeden Docker kontejner,
SQLite, bez přihlašování. **Je vystavená na veřejnou adresu přes Cloudflare**,
takže dnes může kdokoli s odkazem přepsat cizí objednávku.

Zavádíme účty. Hranice nevede mezi „kdo se dívá" a „kdo ne", ale mezi **dívat se**
a **měnit**:

| | Bez přihlášení | Uživatel | Správce |
|---|---|---|---|
| Číst jídelníček, objednávky, historii | ✅ | ✅ | ✅ |
| Měnit **svoji** objednávku | — | ✅ | ✅ |
| Měnit cizí objednávku | — | — | ✅ |
| Založit hosta pod sebou | — | ✅ | ✅ |
| Odeslat objednávku, zavřít den | — | — | ✅ |
| Nastavení, uživatelé, záloha | — | — | ✅ + PIN |

Veřejné čtení **zůstává** (R1) — vrátná musí vidět počty, aniž by měla účet.

---

## 2. Rozsah

### Vytvoříš (nové soubory)

```
lib/auth/schema.ts      migrace tabulek
lib/auth/password.ts    scrypt
lib/auth/tokens.ts      generování a otisky tokenů
lib/auth/users.ts       CRUD účtů + vazba na strávníka
lib/auth/sessions.ts    sezení
lib/auth/oauth.ts       Google přes openid-client
lib/auth/invites.ts     pozvánky hostů
lib/auth/mail.ts        potvrzovací a obnovovací e-maily
lib/auth/guards.ts      requireSession, requireAdmin, assertCanEditRow
lib/auth/errors.ts      AuthError

app/api/auth/google/start/route.ts
app/api/auth/google/callback/route.ts

tools/auth.test.mjs
tools/invites.test.mjs
```

### Upravíš (chirurgicky, minimum řádků)

- **`lib/db.ts`** — přidej `migrateAuth(db)` k ostatním migracím, hned za
  `backfillPeople(db)`. Nic jiného v tom souboru neměň.
- **`lib/settings.ts`** — přidej klíče `googleClientId`, `googleClientSecret`
  přesně podle vzoru existujícího `telegramBotToken` (pole v `AppSettings`,
  mapování na DB klíč, výchozí `""`).
- **`package.json`** — přidej `openid-client` (aktuální 6.x).

### Nesaháš

- `app/components/**` — celé UI
- `app/actions.ts` — server actions zapojím já
- `app/globals.css`
- `lib/orders.ts`, `lib/pizza.ts`, `lib/menu.ts`, `lib/order-pdf.ts`,
  `lib/order-email.ts`, `lib/scheduler.ts` a další existující moduly
- `lib/people.ts` — **hotové a otestované**, jen z něj importuješ
- `app/api/backup/route.ts` — viz past č. 6

Pracuj na větvi odvozené z `feat/ucty`. Žádný `push --force`, `reset --hard`
ani přepisování historie.

---

## 3. Konvence repa — přečti dřív, než začneš

Tohle není generický Next.js projekt. Drž se toho, co už tam je:

**Databáze.** `getDb()` z `lib/db.ts` je singleton, `better-sqlite3` je
**synchronní** — žádné `await` nad dotazy. WAL mode, `PRAGMA foreign_keys = ON`
(cizí klíče se **vynucují**, takže záleží na pořadí mazání). Migrace se píšou
jako `CREATE TABLE IF NOT EXISTS` a `try { ALTER TABLE … } catch {}`, aby šly
spustit opakovaně — spouští se při každém startu.

**Audit.** Každý zásah do účtů loguj přes `logAudit()` z `lib/audit.ts`. Nové
akce: `user_register`, `user_login`, `user_login_failed`, `user_logout`,
`user_block`, `user_unblock`, `user_delete`, `password_change`,
`password_reset_request`, `invite_create`, `invite_use`, `invite_revoke`.

**Omezení pokusů.** `lib/rate-limit.ts` má `checkRateLimit(key, max, windowMs)`
a `isRateLimited(key, max)`. **Počítej jen neúspěchy.** Kdyby budget ubíral
každý pokus, deset úspěšných přihlášení by uživatele vyhodilo — přesně tahle
chyba tam už jednou byla. Vzor je v `lib/api-auth.ts`.

**Nastavení.** `lib/settings.ts`; hodnota v databázi má přednost před proměnnou
prostředí. Všechna pole jsou `string`.

**Jazyk.** Kód a identifikátory anglicky, **komentáře a všechny chybové hlášky
pro uživatele česky** včetně diakritiky. Komentáře piš jen tam, kde vysvětlují
*proč*, ne *co* — koukni do `lib/people.ts`, to je referenční styl.

**TypeScript strict.** `npx tsc --noEmit` nesmí ohlásit nic v souborech, kterých
ses dotkl. (Chyby v `tools/gravityui-reference-mcp/**` jsou cizí a existující —
ignoruj je.)

---

## 4. Schéma

```sql
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL,              -- jak ho člověk napsal
  email_normalized  TEXT    NOT NULL UNIQUE,       -- lowercase + trim, klíč
  email_verified_at TEXT,
  password_hash     TEXT,                          -- NULL = jen přes Google
  name              TEXT    NOT NULL,
  role              TEXT    NOT NULL DEFAULT 'user',    -- admin | user
  status            TEXT    NOT NULL DEFAULT 'active',  -- active | blocked
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at     TEXT
);

CREATE TABLE IF NOT EXISTS user_identities (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider  TEXT    NOT NULL,                      -- 'google'
  subject   TEXT    NOT NULL,                      -- Google 'sub'
  linked_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, subject)
);

-- kdo smí objednávat za koho
CREATE TABLE IF NOT EXISTS user_people (
  user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, person_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT    NOT NULL UNIQUE,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  idle_expires_at     TEXT    NOT NULL,
  absolute_expires_at TEXT    NOT NULL,
  persistent          INTEGER NOT NULL DEFAULT 0,
  user_agent          TEXT
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL,                     -- 'reset' | 'verify'
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS guest_invites (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash        TEXT    NOT NULL UNIQUE,
  inviter_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT    NOT NULL,
  used_at           TEXT,
  revoked_at        TEXT,
  created_person_id INTEGER REFERENCES people(id)
);
```

Indexy: `sessions(user_id)`, `login_tokens(user_id)`, `guest_invites(inviter_user_id)`.

Časy ukládej jako `datetime('now')` v **UTC**, stejně jako `audit_log`. Aplikace
je jinak celá v `Europe/Prague`, ale u sezení se počítá s absolutními okamžiky.

### Co už existuje a nesmíš rozbít

```
people        id · name · department_id · guest_of_person_id? · active
order_rows    … · person_id → people(id)
              … · person_name    ← OTISK jména v době objednávky
```

`order_rows.person_name` je **otisk, ne odkaz**. Přejmenování strávníka historii
nemění — to je záměr a testy to hlídají. Nikdy ho nepřepisuj.

---

## 5. Moduly

### `lib/auth/password.ts`

```ts
export function hashPassword(plain: string): string;
export function verifyPassword(plain: string, stored: string): boolean;
export function checkPasswordStrength(plain: string): { ok: boolean; reason?: string };
```

- scrypt **N=2^17, r=8, p=1**, keylen 32, sůl 16 náhodných bajtů na účet.
  Změřeno na cílovém stroji: 301 ms. Neměň parametry bez měření.
- Formát uložení ať je sebepopisný, aby šly parametry někdy zvýšit:
  `scrypt$17$8$1$<sůl base64>$<otisk base64>`.
- Porovnávej `crypto.timingSafeEqual`.
- `verifyPassword` nad neznámým formátem vrátí `false`, **nikdy nevyhodí výjimku**.
- Minimální délka **12 znaků**, žádné povinné „složitosti" (velká písmena,
  číslice). Delší heslo je lepší než složitější.

### `lib/auth/tokens.ts`

```ts
export function newToken(): { token: string; hash: string };
export function hashToken(token: string): string;
```

32 náhodných bajtů → base64url. V databázi **jen SHA-256 otisk**. Tokeny sezení
a pozvánek jsou plná náhoda, takže rychlý hash je správně — pomalý hash je jen
pro hesla, která náhoda nejsou.

### `lib/auth/users.ts`

```ts
export interface AuthUser {
  id: number; email: string; name: string;
  role: "admin" | "user"; status: "active" | "blocked";
  emailVerified: boolean; createdAt: string; lastLoginAt: string | null;
  providers: string[];          // ["google"] nebo [] u hesla
  personIds: number[];
}

export function createUserWithPassword(input: {
  email: string; name: string; password: string;
  departmentId: number | null;
  claimPersonId?: number;       // převzetí strávníka z historie
}): { userId: number; personId: number };

export function createUserFromGoogle(input: {
  email: string; name: string; subject: string;
  departmentId: number | null; claimPersonId?: number;
}): { userId: number; personId: number };

export function getUserByEmail(email: string): AuthUser | null;
export function getUserById(id: number): AuthUser | null;
export function listUsers(): AuthUser[];
export function setUserStatus(id: number, status: "active" | "blocked"): void;
export function setUserRole(id: number, role: "admin" | "user"): void;
export function deleteUser(id: number): void;
export function changePassword(userId: number, newPlain: string): void;
export function linkGoogleIdentity(userId: number, subject: string): void;
export function markEmailVerified(userId: number): void;
```

Pravidla, která z toho nesmí vypadnout:

- **R3 — strávník vzniká automaticky.** Založení účtu vždy vytvoří i řádek
  v `people` a vazbu v `user_people`. Nikdo nesmí skončit přihlášený bez strávníka.
- **Veřejný `claimPersonId` je po bezpečnostní revizi zakázaný.** Jméno,
  oddělení ani veřejné ID nejsou důkaz identity a převzetí by rovnou předalo
  právo měnit existující objednávky. Registrace vždy založí nového strávníka;
  případnou historii sloučí správce přes chráněnou správu lidí. Volitelné pole
  zůstává v signatuře kvůli kompatibilitě, ale backend je konzervativně odmítne.
- **R10 — smazání účtu strávníka nemaže.** `deleteUser` smaže `users` (kaskáda
  vezme identity, sezení, pozvánky), ale strávníka jen označí `active = 0`.
  Historie a součty za minulé měsíce musí zůstat sedět.
- **R6 — spojení Googlu s existujícím účtem až po ověření heslem.** Když přijde
  Google login na e-mail, který už má účet s heslem a nemá navázanou identitu,
  **nepřihlašuj**. Vrať stav „účet existuje, potvrď heslem". Shoda e-mailu sama
  o sobě není důkaz.
- Po spárování rozhoduje **`subject`**, ne e-mail. Google e-mail může změnit.
- `changePassword` a `setUserStatus(…, "blocked")` **zneplatní všechna ostatní
  sezení** uživatele.
- Chyba při registraci **nevyzradí, jestli e-mail existuje**. Stejná hláška
  i stejná doba odpovědi pro obojí.

**První správce (R11).** Při migraci: pokud v `users` není žádný `admin`
a jsou nastavené `ADMIN_EMAIL` + `ADMIN_PASSWORD`, založ účet správce. Appka
pak nese příznak, že bootstrapovací heslo nebylo změněno — vystavíš ho jako
`isBootstrapPasswordUnchanged(): boolean`, zbytek dodělám v UI. Musí existovat
dřív, než se kdokoli přihlásí, jinak se nikdo nedostane do Nastavení.

### `lib/auth/sessions.ts`

```ts
export const SESSION_COOKIE = "kantyna_session";

export interface SessionInfo {
  sessionId: number; userId: number;
  role: "admin" | "user"; personIds: number[];
}

export function createSession(userId: number, opts: {
  persistent: boolean; userAgent?: string;
}): { token: string; expiresAt: string };

export function readSession(token: string): SessionInfo | null;
export function revokeSession(token: string): void;
export function revokeAllSessions(userId: number, exceptSessionId?: number): void;
export function listSessions(userId: number): SessionRow[];
export function pruneExpiredSessions(): void;
```

Platnosti (OWASP Session Management; nízkorizikové použití, ale absolutní strop
je povinný vždy):

| Režim | Nečinnost | Absolutní strop | Cookie |
|---|---|---|---|
| Bez „zůstat přihlášen" | 8 hodin | 24 hodin | zaniká se zavřením prohlížeče |
| Zůstat přihlášen | 30 dní | 180 dní | trvalá |

`readSession` musí při **každém** volání ověřit obojí — nečinnost i strop — a taky
`users.status = 'active'`. Posun `idle_expires_at` nikdy nesmí přelézt
`absolute_expires_at`.

Drobnost, ať se nezapisuje při každém requestu: `last_seen_at` a klouzavou
platnost aktualizuj, jen když je poslední zápis starší než ~60 sekund.

Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` v produkci
(`process.env.NODE_ENV === "production"` — lokálně běží vývoj na http).

### `lib/auth/guards.ts`

```ts
export async function getSession(): Promise<SessionInfo | null>;
export async function requireSession(): Promise<SessionInfo>;
export async function requireAdmin(): Promise<SessionInfo>;
export async function assertCanEditRow(s: SessionInfo, rowId: number): Promise<void>;
export async function assertCanActAsPerson(s: SessionInfo, personId: number): Promise<void>;
```

Čtou cookie přes `cookies()` z `next/headers`. Při neúspěchu vyhoď `AuthError`
z `lib/auth/errors.ts` s kódem (`NEPRIHLASEN`, `BLOKOVAN`, `CIZI_ZAZNAM`,
`JEN_SPRAVCE`) a českou hláškou. Kód potřebuju v UI, abych blokovanému účtu
ukázal klidnou hlášku ve stylu zavřeného provozu (R14), ne strohou chybu.

**`assertCanEditRow` kontroluje vlastnictví, ne jen přihlášení** (R8): řádek
patří session, když `order_rows.person_id ∈ session.personIds`, nebo je session
správce. Zamítni ve výchozím stavu — neznámý řádek je „ne".

> **Proč vrstvy a ne middleware.** V Next.js App Routeru **middleware není
> bezpečnostní hranice**: CVE-2025-29927 ho umí obejít a server actions jdou
> volat přímo, mimo cestu, kterou middleware vidí. Middleware je jen rychlé
> odmítnutí a přesměrování. Skutečná kontrola patří do guardů těsně před zápisem.
> Piš je tak, aby fungovaly samy o sobě, i kdyby middleware neexistoval.

### `lib/auth/oauth.ts`

```ts
export function isGoogleConfigured(): boolean;
export async function buildGoogleAuthUrl(redirectUri: string): Promise<{
  url: string; state: string; nonce: string; codeVerifier: string;
}>;
export async function completeGoogleLogin(currentUrl: URL, checks: {
  state: string; nonce: string; codeVerifier: string; redirectUri: string;
}): Promise<{ email: string; emailVerified: boolean; subject: string; name: string }>;
```

- **PKCE (S256)**, `state` i `nonce` jednorázové a vázané na relaci prohlížeče —
  ulož je do krátkodobé `HttpOnly` cookie (10 minut), ne do databáze.
- **Přijmi jen `email_verified === true`.** Neověřený e-mail od Googlu není důkaz.
- `client_id` a `client_secret` ber z `getSettings()`, s proměnnou prostředí jako
  zálohou — stejná konvence jako SMTP a Telegram (R16).
- Krátkodobé OAuth cookies podepisuj samostatným serverovým
  `COOKIE_SIGNING_SECRET` o délce alespoň 32 bajtů. Bez něj Google přihlášení
  vypni; nikdy se nevracej k odvození z `googleClientSecret`.

> **Pozor:** `openid-client` 6.x má **funkcionální API**, ne třídy `Issuer`
> a `Client` z verze 5. Nepiš to z hlavy — otevři si typy nainstalované verze
> v `node_modules/openid-client` a řiď se jimi.

### `lib/auth/invites.ts`

```ts
export function createInvite(inviterUserId: number): { token: string; expiresAt: string };
export function getInvite(token: string): InviteInfo | null;   // jen platná
export function registerGuestWithInvite(
  token: string,
  input:
    | { provider: "password"; email: string; name: string; password: string; departmentId: number | null }
    | { provider: "google"; profileCookie: string; departmentId: number | null }
): { userId: number; personId: number };
export function revokeInvite(inviteId: number, actorUserId: number): void;
export function listInvites(inviterUserId: number): InviteInfo[];
export function countActiveGuests(inviterUserId: number): number;
```

Host není role účtu, ale **vztah mezi dvěma strávníky** (R18) — `guest_of_person_id`.
Uplatnění pozvánky založí účet i strávníka a nastaví mu `guest_of_person_id`
na strávníka pozvatele.

Pravidla, která `createInvite` vynutí (R19, R20):

- platnost **7 dní**, **jednorázová**, v databázi **jen otisk**
- nejvýš **3 aktivní hosté** a **5 čekajících pozvánek** na účet — jinak jeden
  účet tiskne účty donekonečna a otevřená registrace se dá obejít
- **host nesmí zvát dál.** Pokud strávník pozvatele sám má `guest_of_person_id`,
  odmítni. Hloubka jedna, ať odpovědnost zůstane u živého člověka.
- `getInvite` vrací `null` pro použitou, zrušenou i prošlou — volající nemá
  rozlišovat proč
- založení účtu, strávníka, vazby hosta a spotřebování pozvánky je jedna
  transakce přes `registerGuestWithInvite`; UI nikdy neposílá `personId`
- odkaz **nepřihlašuje**, jen otevře registrační formulář. Odkaz, který rovnou
  přihlásí, je heslo poslané po WhatsAppu.

### `lib/auth/mail.ts`

Použij existující `sendEmail()` z `lib/email.ts`, nezakládej druhý transport.

```ts
export async function sendVerificationEmail(userId: number, baseUrl: string): Promise<void>;
export async function sendPasswordResetEmail(email: string, baseUrl: string): Promise<void>;
```

- Odkaz na obnovu hesla: **jednorázový, 15 minut**, v databázi jen otisk.
- `sendPasswordResetEmail` na neexistující e-mail **projde bez chyby** a nic
  nepošle — jinak se z ní stane nástroj na zjišťování, kdo tu má účet.
- Registrace heslem posílá potvrzovací e-mail (R17). Do potvrzení účet
  **funguje**, jen nese značku „neověřeno". Blokovat by pro dvacet kolegů byla
  šikana; správci stačí, že to vidí.
- **Správce cizí heslo nenastavuje** — generuje jednorázový odkaz. Vystav
  `createResetLinkForUser(userId): string` pro potřeby administrace.

---

## 6. Pasti, na které narazíš

1. **`scrypt` a `maxmem`.** N=2^17, r=8 potřebuje `128 · N · r` = **128 MiB**.
   Node má výchozí strop 32 MB a shodí to na `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`.
   Předej `{ N: 2**17, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }`.

2. **`openid-client` 6.x ≠ 5.x.** Viz výše — čti typy, ne paměť.

3. **`better-sqlite3` je synchronní.** `await db.prepare(...)` je chyba, která
   projde typovou kontrolou a vrátí `Promise`.

4. **Cizí klíče jsou zapnuté.** `PRAGMA foreign_keys = ON`. Kaskády nastav
   v DDL a ověř, že smazání účtu neshodí `order_rows`. Nesmí — `order_rows`
   míří na `people`, a ty zůstávají.

5. **Migrace běží při každém startu.** Musí být idempotentní. Bootstrap správce
   se smí provést **jen když žádný admin neexistuje**, jinak se při každém
   restartu přepíše heslo.

6. **Záloha.** `app/api/backup/route.ts` exportuje **výčet** tabulek
   (`orders`, `order_rows`, `menu_items`, `departments`, `settings`). Nové
   tabulky do něj **nepřidávej** — účty, sezení ani tokeny do zálohy nepatří.
   Napiš k tomu test, aby to někdo omylem nedoplnil. Klíč `googleClientSecret`
   patří mezi filtrované v `SENSITIVE_KEYS`.

7. **Otevřená registrace na veřejné adrese láká roboty.** Registraci, přihlášení
   i obnovu hesla omez počtem pokusů na IP. Klíč z `x-forwarded-for` — appka je
   za Cloudflarem, `req.ip` je k ničemu. Vzor v `lib/api-auth.ts`.

8. **Do klientských komponent posílej DTO**, nikdy celý objekt uživatele nebo
   sezení. Otisk hesla ani token se nesmí dostat do serializovaného props.

---

## 7. Testy

Vzor je `tools/people.test.mjs` — `node:test`, dočasná databáze přes
`DB_PATH` v `os.tmpdir()`, `loadLib()` z `tools/test-helpers.mjs`. Skript
`npm test` už běží přes `tools/*.test.mjs`, takže nový soubor se chytí sám —
do `package.json` kvůli testům nesahej. CI (`.github/workflows/test.yml`) ho
spustí a bez zeleného testu se image nepostaví.
Musí projít aspoň tohle:

**Hesla**
- kratší než 12 znaků neprojde
- stejné heslo dá pokaždé jiný otisk (náhodná sůl)
- `verifyPassword` nad poškozeným řetězcem vrátí `false` a nevyhodí

**Účty**
- registrace založí i strávníka a vazbu `user_people` (R3)
- druhá registrace téhož e-mailu jiným zápisem velikosti písmen neprojde
- libovolný veřejný `claimPersonId`, včetně osiřelého strávníka, se odmítne;
  historii může přiřadit až správce
- smazání účtu nechá strávníka i jeho objednávky, jen ho zneaktivní (R10)
- Google login na e-mail s heslem a bez navázané identity **nepřihlásí** (R6)
- po spárování rozhoduje `subject` — změna e-mailu u Googlu přihlášení nerozbije

**Sezení**
- nečinnost i absolutní strop platí každý zvlášť
- klouzavá platnost nikdy nepřeleze absolutní strop
- změna hesla zneplatní ostatní sezení, aktuální nechá
- blokace účtu zneplatní všechna
- token se v databázi nikdy neobjeví v čitelné podobě

**Oprávnění**
- `assertCanEditRow` pustí vlastníka, odmítne cizího, pustí správce
- neznámý řádek se odmítne (zamítnout ve výchozím stavu)

**Pozvánky**
- čtvrtý host se odmítne, šestá čekající pozvánka se odmítne
- host nemůže pozvat dalšího hosta
- použitá, zrušená i prošlá pozvánka se chová stejně: neplatná
- uplatnění nastaví `guest_of_person_id` na strávníka pozvatele

**Záloha**
- export neobsahuje `users`, `user_identities`, `sessions`, `login_tokens`
  ani `guest_invites`

---

## 8. Hotovo, když

```bash
npm run lint && npx tsc --noEmit && npm test
```

projde, a k tomu:

- `git status` neukazuje změny v `app/components/**` ani v `app/actions.ts`
- migrace proběhne dvakrát za sebou nad stejnou databází bez chyby
- `docs/handoff-ucty-backend.md` (tenhle soubor) je doplněný o sekci
  **„Co je hotové a jak to zavolat"** — stručný seznam exportů se signaturami,
  ať na to navážu bez čtení celé implementace

Commity česky, imperativ, jeden logický celek na commit — koukni na `git log`.

---

## 9. Co dělám já po tobě

Zapojení do UI: registrační a přihlašovací obrazovky, přepínač „objednávám za:",
seznam uživatelů a pozvánek v Nastavení, klidná hláška pro blokovaný účet,
ochrana všech zapisujících server actions v `app/actions.ts` a test, který
zapomenutou kontrolu neprojde.

Takže **nepotřebuju hotové obrazovky — potřebuju spolehlivou vrstvu pod nimi.**
Když budeš na vážkách mezi „udělám to univerzálnější" a „udělám to jednoznačné",
volej to druhé.

---

## 10. Co je hotové a jak to zavolat

### Migrace, hesla a tokeny

- `migrateAuth(db: Database.Database): void` (`lib/auth/schema.ts`) — idempotentně
  založí auth tabulky, indexy a případně prvního správce z `ADMIN_EMAIL` +
  `ADMIN_PASSWORD` (`ADMIN_NAME` je volitelné).
- `checkPasswordStrength(plain: string): { ok: boolean; reason?: string }` — ověří
  minimální délku hesla bez pravidel umělé složitosti.
- `hashPassword(plain: string): string` — vytvoří sebepopisný scrypt otisk; slabé
  heslo odmítne.
- `verifyPassword(plain: string, stored: string): boolean` — konstantním časem
  ověří podporovaný otisk a pro cizí nebo poškozený formát vrátí `false`.
- `newToken(): { token: string; hash: string }` — vrátí 256bitový base64url token
  a jeho SHA-256 otisk; do databáze patří jen `hash`.
- `hashToken(token: string): string` — spočítá SHA-256 otisk existujícího tokenu.

### Účty (`lib/auth/users.ts`)

```ts
interface AuthUser {
  id: number; email: string; name: string;
  role: "admin" | "user"; status: "active" | "blocked";
  emailVerified: boolean; createdAt: string; lastLoginAt: string | null;
  providers: string[]; personIds: number[];
}
```

- `createUserWithPassword(input: { email: string; name: string; password: string; departmentId: number | null; claimPersonId?: number }): { userId: number; personId: number }`
  — atomicky založí heslový účet a nového strávníka; veřejný `claimPersonId`
  odmítne, protože bezpečné převzetí historie vyžaduje schválení správce;
  po úspěchu zavolej `sendVerificationEmail`.
- `createUserFromGoogle(input: { email: string; name: string; subject: string; departmentId: number | null; claimPersonId?: number }): { userId: number; personId: number }`
  — založí/rozpozná Google účet podle `subject`, veřejný `claimPersonId` odmítne;
  při pouhé shodě e-mailu vyhodí `GoogleLinkRequiredError`, nikdy účty nespojí
  automaticky.
- `getUserByEmail(email: string): AuthUser | null`, `getUserById(id: number): AuthUser | null`
  a `listUsers(): AuthUser[]` — vracejí pouze bezpečné DTO bez hesel a tokenů.
- `authenticateWithPassword(email: string, plain: string): AuthUser | null` — ověří
  přihlašovací údaje se stejně drahou falešnou kontrolou pro neznámý e-mail;
  limit neúspěchů na IP musí volající uplatnit přes `lib/rate-limit.ts`.
- `verifyUserPassword(userId: number, plain: string): boolean` — ověří heslo při
  citlivé operaci, zejména před `linkGoogleIdentity`.
- `setUserStatus(id: number, status: "active" | "blocked"): void` — blokace
  okamžitě zneplatní sezení; posledního aktivního správce zablokovat nejde.
- `setUserRole(id: number, role: "admin" | "user"): void` — změní roli, ale
  nedovolí odebrat posledního aktivního správce.
- `deleteUser(id: number): void` — smaže účet a kaskádované auth údaje, strávníka
  jen deaktivuje a historii ponechá.
- `changePassword(userId: number, newPlain: string, exceptSessionId?: number): void`
  — změní heslo a zruší všechna sezení kromě výslovně uvedeného aktuálního.
- `linkGoogleIdentity(userId: number, subject: string): void` — naváže ověřený
  Google `subject`; volej až po `verifyUserPassword`, nikdy jen podle e-mailu.
- `markEmailVerified(userId: number): void` — důvěryhodné serverové volání označí
  e-mail jako ověřený; běžný odkaz zpracuj přes `consumeVerificationToken`.
- `isBootstrapPasswordUnchanged(): boolean` — řekne, zda první správce stále
  používá bootstrapovací heslo.

### Sezení a guardy

```ts
const SESSION_COOKIE = "kantyna_session";
interface SessionInfo {
  sessionId: number; userId: number;
  role: "admin" | "user"; personIds: number[];
}
interface SessionRow {
  id: number; createdAt: string; lastSeenAt: string;
  idleExpiresAt: string; absoluteExpiresAt: string;
  persistent: boolean; userAgent: string | null;
}
```

- `createSession(userId: number, opts: { persistent: boolean; userAgent?: string }): { token: string; expiresAt: string }`
  — založí nové náhodné sezení aktivního účtu a vrátí jedinou čitelnou kopii tokenu.
- `getSessionCookieOptions(persistent: boolean, expiresAt: string)` — vrátí
  jednotné `HttpOnly`, `SameSite=Lax`, `Path=/` a produkční `Secure` volby cookie.
- `readSession(token: string): SessionInfo | null` — při každém čtení ověří idle
  limit, absolutní strop, aktivní účet a vazbu na strávníka.
- `revokeSession(token: string): void`, `revokeAllSessions(userId: number, exceptSessionId?: number): void`
  — zruší jedno nebo všechna vybraná sezení.
- `listSessions(userId: number): SessionRow[]` — vypíše sezení bez tokenů a jejich
  otisků; `pruneExpiredSessions(): void` odstraní prošlá.
- `isBlockedSessionToken(token: string): boolean` — interně pomáhá guardu odlišit
  zablokovaný účet od nepřihlášeného, ale nikdy nevrací platné sezení.
- `getSession(): Promise<SessionInfo | null>`, `requireSession(): Promise<SessionInfo>`,
  `requireAdmin(): Promise<SessionInfo>` a `requireAdminWithPin(): Promise<SessionInfo>`
  (`lib/auth/guards.ts`) — čtou
  `kantyna_session`; povinné varianty vyhazují `AuthError`. `requireSession`
  navíc odmítne provoz bez aktivního správce, takže veřejná registrace sama
  nikdy neotevře objednávkové zápisy; obnova je jen přes bootstrap z prostředí.
- `assertCanEditRow(s: SessionInfo, rowId: number): Promise<void>` — pustí správce
  nebo vlastníka `order_rows.person_id`, neznámý řádek vždy odmítne.
- `assertCanActAsPerson(s: SessionInfo, personId: number): Promise<void>` — pustí
  správce nebo uživatele s daným `personId` ve svém sezení.
- `AuthError` a `AuthErrorCode = "NEPRIHLASEN" | "BLOKOVAN" | "CIZI_ZAZNAM" | "JEN_SPRAVCE" | "VYZADOVAN_PIN"`
  (`lib/auth/errors.ts`) — dávají UI stabilní kód a českou uživatelskou hlášku.

Přihlášení heslem: použij vrstvený limit na hash normalizovaného e-mailu,
globální rozpočet a pouze u ověřeného Cloudflare ingressu i canonical IP.
Po úspěchu vytvoř sezení a cookie nastav pomocí
`getSessionCookieOptions`. Při odhlášení zavolej `revokeSession` a cookie smaž.

### Bezpečnostní integrace pro UI

- `issuePinProof(session: SessionInfo, now?: number): string` a
  `verifyPinProof(value: string | undefined, session: SessionInfo, now?: number): boolean`
  (`lib/auth/pin-gate.ts`) — vystaví a ověří 30minutový PIN step-up vázaný na
  konkrétní admin session; `PIN_COOKIE` a `pinCookieOptions()` slouží pro HttpOnly cookie.
- PIN ověřuje pouze rate-limitovaná `actionCheckPin`. Všechny další citlivé
  operace, včetně odemknutí uzávěrky a uložení Nastavení, přijímají jen admin
  session s platným HttpOnly step-up dokladem; raw PIN argument není autorita.
  UI proto nejprve volá `actionCheckPin` a teprve po úspěchu cílovou akci. PIN
  pole musí přijmout 8 až 128 libovolných znaků, ne jen osm číslic.
- `getSettingsForClient(): AppSettings` (`lib/settings.ts`) — vrátí klientský
  objekt s maskovanými tajemstvími a bez PINu; tajemství jsou write-only.
- `sanitizeClientSettingsUpdates(updates: Partial<AppSettings>): Partial<AppSettings>`
  — zahodí maskované/prázdné secrety a vynutí nový PIN o délce 8 až 128 znaků.
- `assertMayEditRow(session, rowId)` a `assertMayEditPizzaRow(session, rowId)`
  (`lib/auth/policy.ts`) — vynutí vlastnictví obědového i pizza řádku; NULL
  vlastník je jen pro správce.
- `resolveOwnPerson(session, personName): { personId: number; name: string } | null`
  — převede jméno výhradně na přesné `personId` z dané session, ne globálním
  hledáním podle textu.
- `safeInternalPath(raw): string` (`lib/auth/navigation.ts`) — vrátí pouze
  bezpečnou interní návratovou cestu; odmítá i backslash varianty otevřeného redirectu.
- `getCanonicalAppOrigin(): string` (`lib/auth/app-url.ts`) — vrátí čistý
  kanonický HTTPS origin z `APP_URL`/nastavení bez důvěry v Host hlavičku.
- `getClientIpFromHeaders(headers): string` (`lib/api-auth.ts`) — přijme
  `CF-Connecting-IP` jen při `TRUST_CLOUDFLARE_PROXY=true`, jinak vrací sdílený
  nedůvěryhodný subjekt a X-Forwarded-For ignoruje.

### Google (`lib/auth/oauth.ts` a route handlery)

- `isGoogleConfigured(): boolean` — ověří přítomnost ID a secretu; databázové
  `googleClientId`/`googleClientSecret` mají přednost před
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` a zároveň vyžaduje samostatný
  `COOKIE_SIGNING_SECRET` o délce alespoň 32 bajtů.
- `buildGoogleAuthUrl(redirectUri: string): Promise<{ url: string; state: string; nonce: string; codeVerifier: string }>`
  — přes `openid-client` 6.x vytvoří Authorization Code URL s PKCE S256, `state`
  a `nonce`.
- `completeGoogleLogin(currentUrl: URL, checks: GoogleFlowCookie): Promise<{ email: string; emailVerified: boolean; subject: string; name: string }>`
  — ověří přesný callback, PKCE/state/nonce, podpis ID tokenu a přijme jen
  `email_verified === true`.
- `GOOGLE_FLOW_COOKIE`, `sealGoogleFlowCookie(checks)` a
  `readGoogleFlowCookie(value)` — pracují s desetiminutovým HMAC podepsaným stavem
  rozběhnutého přihlášení.
- `GOOGLE_LINK_COOKIE`, `sealPendingGoogleLink(value)` a
  `readPendingGoogleLink(value)` — drží deset minut podepsaný stav pro bezpečné
  potvrzení existujícího heslového účtu.

`GET /api/auth/google/start` zahájí přihlášení, `GET /api/auth/google/callback`
ho dokončí a založí netrvalé sezení. V produkci nastav `APP_URL` na kanonický
HTTPS origin a u Googlu zaregistruj přesně
`<APP_URL>/api/auth/google/callback`. `COOKIE_SIGNING_SECRET` vygeneruj nezávisle
na Google credentials, například `openssl rand -base64 32`; jeho rotace
zneplatní nejvýše deset minut staré OAuth cookies. Stav
`auth=google-link-required` znamená:
na serveru načíst `GOOGLE_LINK_COOKIE`, zavolat `readPendingGoogleLink`, heslo
ověřit přes `authenticateWithPassword`, navázat vrácený `subject` přes
`linkGoogleIdentity`, založit sezení a pending cookie smazat. Cookie nikdy
neparsuj v klientu ani její obsah neposílej do props.

### Pozvánky (`lib/auth/invites.ts`)

```ts
interface InviteInfo {
  id: number; inviterUserId: number; inviterName: string;
  createdAt: string; expiresAt: string; usedAt: string | null;
  revokedAt: string | null; createdPersonId: number | null;
}
type GuestRegistrationInput =
  | { provider: "password"; email: string; name: string; password: string; departmentId: number | null }
  | { provider: "google"; profileCookie: string; departmentId: number | null };
```

- `createInvite(inviterUserId: number): { token: string; expiresAt: string }` —
  vytvoří sedmidenní odkaz, pokud účet není host a nepřekročil limity.
- `getInvite(token: string): InviteInfo | null` — vrátí pouze dosud platnou
  pozvánku; použitou, zrušenou a prošlou nerozlišuje.
- `registerGuestWithInvite(token: string, input: GuestRegistrationInput): { userId: number; personId: number }`
  — v jediné transakci založí nový heslový nebo Google účet, jeho strávníka,
  nastaví `guest_of_person_id` a spotřebuje pozvánku. `GuestRegistrationInput`
  je diskriminované sjednocení podle signatury výše; veřejné API nepřijímá
  `personId` ani `claimPersonId`. Google varianta přijímá jen hodnotu vytvořenou
  přes `sealPendingGoogleLink` po úspěšném `completeGoogleLogin`; profil ani
  `subject` z formuláře do ní neposílej.
- `revokeInvite(inviteId: number, actorUserId: number): void` — dovolí zrušení
  jen vlastníkovi nepoužité pozvánky.
- `listInvites(inviterUserId: number): InviteInfo[]` a
  `countActiveGuests(inviterUserId: number): number` — vrátí bezpečný přehled bez
  tokenů a počet aktivních hostů.

### E-maily a jednorázové odkazy (`lib/auth/mail.ts`)

- `sendVerificationEmail(userId: number, baseUrl: string): Promise<void>` — přes
  existující `sendEmail` odešle 24hodinový ověřovací odkaz; ověřenému účtu nic
  neposílá.
- `sendPasswordResetEmail(email: string, baseUrl: string): Promise<void>` — odešle
  15minutový obnovovací odkaz; neexistující nebo blokovaný e-mail skončí stejně
  úspěšně a bez zprávy.
- `createResetLinkForUser(userId: number): string` — vytvoří relativní
  `/ucet/obnovit-heslo?token=…` pro administraci bez nastavování cizího hesla.
- `consumeVerificationToken(token: string): number` — jednorázově označí e-mail
  aktivního účtu jako ověřený a vrátí jeho `userId`.
- `resetPasswordWithToken(token: string, newPlain: string): number` — jednorázově
  nastaví nové heslo, zruší všechna sezení a vrátí `userId`.

`baseUrl` ber jen z kanonického nastavení aplikace, ne z `Host`/`X-Forwarded-Host`.
UI routy pro odkazy jsou `/ucet/overit-email` a `/ucet/obnovit-heslo`; jejich
server actions musí před voláním ověřit a započítat neúspěchy na IP stejně jako
přihlášení. Běžná registrace heslem má po `createUserWithPassword` a registrace
hosta po `registerGuestWithInvite` bez čekání na ověření zavolat
`sendVerificationEmail`.
