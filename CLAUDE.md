# Kontext aplikace — Objednávky obědů a pizzy

Firemní webová aplikace pro sdílené objednávky obědů (LIMA) a pizzy.
Běží jako **jeden Docker kontejner**, bez přihlášení — přístup omezený sítí.

---

## Tech stack

| Vrstva | Technologie |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Jazyk | TypeScript (striktní) |
| CSS | Tailwind CSS 4 + vlastní třídy v `globals.css` |
| Databáze | SQLite přes `better-sqlite3` (singleton, WAL mode) |
| E-mail | nodemailer |
| PDF export | pdfkit |
| PDF import | pdf-parse |
| Scheduler | node-cron (spouštěn přes `instrumentation.ts`) |
| Real-time | SSE (Server-Sent Events) |
| Push | web-push (VAPID), service worker `public/sw.js` |
| Testy | vitest (`*.test.ts` vedle kódu) + `node --test` (`tools/*.test.mjs`) |
| Runtime | Node.js 24, Docker |

Tahle tabulka jmenuje jen hlavní verze. **Autoritativní zdroj konkrétní verze je
`package.json` a `package-lock.json`** — při rozporu platí ony, ne tenhle popis.

---

## Struktura projektu

```
app/
  page.tsx                         # Hlavní stránka — dnešní objednávka obědů
  layout.tsx                       # Root layout
  error.tsx                        # Error boundary
  actions.ts                       # Všechny React Server Actions
  globals.css                      # Veškeré CSS
  manifest.ts                      # PWA manifest (ikony, zkratky, barvy)
  icon.svg, apple-icon.tsx         # Favicon a ikona pro iOS
  pwa-icon/[variant]/route.tsx     # Ikony pro manifest (192/512, maskable)
  pwa-splash/[size]/route.tsx      # Úvodní obrazovky pro iOS

  components/
    AppTopBar.tsx                  # Postranní panel (desktop); položky navigace
    MobileNav.tsx                  # Spodní navigace na mobilu: pilulka s tažením, nabídka „Více“
    SheetDragManager.tsx           # Stahování spodních oken (.modal-sheet) prstem, pro všechna okna naráz
    InstallHint.tsx                # Nabídka „přidat na plochu“ na mobilu
    SwRegister.tsx                 # Registrace service workeru
    MIcon.tsx                      # Inline SVG ikony (registr; neznámé jméno nic nevykreslí)
    OrderPage.tsx                  # Klientská komponenta hlavní stránky
    order/                         # Části OrderPage: OrderHeader, OrderRow, OrderEditModal,
                                   # DayPicker, hooky (useOrderSync, useCutoff, useDayNavigation,
                                   # usePushNotifications, useRowDeletion), offline-snapshot
    DepartmentPanel.tsx            # Panel oddělení se seznamem řádků
    OrderDetailPage.tsx            # Read-only detail historické objednávky
    HistoryPage.tsx                # Seznam historických objednávek
    MenuPage.tsx                   # Správa jídelníčku (import PDF, editace)
    PizzaPage.tsx                  # Objednávky pizzy
    pizza/                         # PizzaRow, PizzaSelect, PizzaPriceBreakdown
    PizzaDetailPage.tsx            # Detail historické pizza objednávky
    SettingsPage.tsx               # Nastavení (PIN chráněno)
    FeedbackPage.tsx               # Stránka připomínek (skládá feedback/*)
    feedback/                      # Composer, dlaždice kategorií, podpis, poděkování,
                                   # „Jak to funguje“, časová osa změn, useFeedbackDraft
    settings/FeedbackSection.tsx   # Správa připomínek v Nastavení

  api/
    sse/route.ts                   # SSE endpoint — push změn klientům
    order-refresh/route.ts         # GET — aktuální stav objednávky (pro SSE)
    backup/route.ts                # GET — JSON export celé databáze
    smtp-test/route.ts             # POST — test SMTP s hodnotami z formuláře
    menu/import/route.ts           # POST — ruční přidání položky jídelníčku
    menu/pdf/[weekStart]/route.ts  # POST — import jídelníčku z PDF
    pizza/scrape/route.ts          # GET — scraping cen pizzy z webu pizzerie
    push/route.ts                  # GET veřejný VAPID klíč, POST/DELETE odběr push
    orders/[id]/pdf/route.ts       # GET — PDF odeslané objednávky
    restore/route.ts               # POST — obnova databáze ze zálohy
    feedback/…                     # Připomínky: odeslání, mine, vote, withdraw, attachments
    telegram/webhook/              # Telegram bot: route.ts (handler), messages.ts (texty),
                                   # keyboards.ts (klávesnice), telegram-api.ts (volání API)
    health, ping, version          # Diagnostika

  historie/
    page.tsx                       # Seznam objednávek
    [id]/page.tsx                  # Detail oběd objednávky
    pizza/[id]/page.tsx            # Detail pizza objednávky

  jidelnicek/page.tsx
  pizza/page.tsx
  nastaveni/page.tsx
  pripominky/page.tsx              # Veřejná stránka připomínek k aplikaci

lib/
  db.ts           # SQLite singleton + migrace všech tabulek
  types.ts        # Všechny TypeScript typy (OrderRow, DepartmentData, ...)
  settings.ts     # Čtení/zápis nastavení, kontrola PINu (SHA-256)
  orders.ts       # CRUD oběd objednávky + sendOrder()
  departments.ts  # CRUD oddělení (getDepartments, add, update, delete, reorder)
  audit.ts        # Audit log — logAudit(), getAuditLog(), getRecentAuditLog()
  menu.ts         # CRUD jídelníček
  parse-menu.ts   # Parser PDF jídelníčku
  order-email.ts  # Sestavení HTML e-mailu objednávky
  order-pdf.ts    # Generování PDF příloh (pdfkit, landscape A4)
  email.ts        # Odeslání e-mailu přes nodemailer + getOrderRecipients()
  pricing.ts      # computeRowPrice() — výpočet ceny řádku
  order-utils.ts  # hasOrderRowContent(), isDepartmentSubmitted()
  rate-limit.ts   # SQLite rate limiting (čistí expirované záznamy automaticky)
  scheduler.ts    # Auto-send cron job (node-cron, Praha timezone)
  sse-broadcast.ts # Pub/sub pro SSE — broadcast() volají Server Actions
  pizza.ts        # CRUD pizza objednávky
  pizza-utils.ts  # Utility pro pizzu
  feedback.ts     # Připomínky: validace (zod), CRUD, veřejné odpovědi, text pro Telegram
  feedback-meta.ts # Kategorie/stavy/typy připomínek — bez DB, importuje i klient
  feedback-attachments.ts # Screenshoty: sharp re-encode do WebP, úložiště, limity
  push.ts         # Web Push: odběry, sendPush(), getOrderedPushEndpoints()
  pwa-assets.ts   # Seznam ikon a iOS úvodních obrazovek (pro routy, manifest i metadata)
  cutoff.ts, time.ts, closures.ts, holidays.ts  # Uzávěrka, pražský čas, dovolené, svátky
  telegram.ts, imap.ts            # Telegram bot, import jídelníčku z e-mailu
  release-notes.ts, version.ts    # „Co je nového“ v appce, build metadata

public/
  sw.js           # Service worker: push notifikace + stránka „Bez připojení“
  offline.html    # Statická offline stránka; čte snímek objednávky z localStorage

tools/            # check-changelog.mjs (CI), testy node --test, generate-emoji.mjs

instrumentation.ts  # Next.js hook — startScheduler() při startu Node.js procesu
```

---

## Databázové schéma (SQLite)

### `orders`
Jedna objednávka = jeden den.
```
id | date (UNIQUE) | status ("draft"|"sent") | extra_email | sent_at
```

### `order_rows`
Každý řádek = jedna osoba v jednom oddělení.
```
id | order_id (FK) | department (TEXT, name z departments tabulky)
sort_order | person_name
soup_item_id (FK) | soup_item_id_2 (FK)
main_item_id (FK) | meal_count
extra_meals (JSON: [{itemId, count}])
roll_count | bread_dumpling_count | potato_dumpling_count
ketchup_count | tatarka_count | bbq_count | note
push_endpoint (prohlížeč, který řádek založil — kvůli push; do OrderRow se nemapuje)
```

### `menu_items`
```
id | week_label | week_start | day (Po/Ut/St/Ct/Pa)
type ("Polevka"|"Jidlo") | code | name | price
```

### `departments`
Dynamická oddělení — nahradily původní hardcoded konstanty.
```
id | name (UNIQUE, interní klíč) | label (zobrazovaný název)
email_label (název v PDF/e-mailu) | accent ("blue"|"rust"|"green")
sort_order | active (0/1, soft delete)
```
Výchozí seedy: Konstrukce (blue, 0), Dílna (rust, 1), Kanceláře (green, 2).

### `settings`
Key-value tabulka. Viz `lib/settings.ts` pro mapování klíčů.

### `rate_limits`
```
key (PRIMARY KEY) | count | reset_at (Unix timestamp ms)
```

### `audit_log`
```
id | ts (UTC datetime) | action | order_id | department | person_name | details
```
Akce: `row_add`, `row_update`, `row_delete`, `order_send`, `order_reopen`, `order_clear`, `auto_send`.
`row_update` se loguje jen při změně: personName, soupItemId, soupItemId2, mainItemId, extraMeals.

### `feedback`
Připomínky k aplikaci. Záměrně bez IP adresy a user-agentu.
```
id | created_at (UTC) | category | message | author_name (od 1.6.0 vždy prázdné — anonymní)
page (cesta, odkud přišel) | device ("mobil"|"počítač"|"")
status ("new"|"read"|"planned"|"done"|"rejected")
admin_note | public_reply | resolved_at (první přechod do "done")
secret_hash (SHA-256 kódu autora) | context | app_version | status_changed_at
votable (0/1) | vote_title | hidden (0/1) | is_proposal (0/1) | merged_into (id cílové, sloučená duplicita)
github_issue | github_issue_state ("open"|"closed"|"")
```
Veřejně jdou tři věci:
- `getPublicFeedback` („Připomínky ostatních“): `message` připomínek z `PUBLIC_CATEGORIES` (napad, ovladani, mobil, jine), které nejsou `hidden`, `votable`, `is_proposal` ani sloučené — otevřené a 60 dní i vyřízené (done/rejected, u nich i `public_reply`). Jen text, kategorie, stav, datum, hlasy. Nikdy stránka, zařízení, context, screenshoty ani admin_note. Hlasovat jde jen o otevřené.
- `getVotableFeedback` („Co chystáme“): jen `vote_title` (návrhy správce `is_proposal = 1` a připomínky, které dal k hlasování).
- `getPublicFeedbackReplies` („Změnili jsme díky vám“): jen `public_reply` hotových připomínek.

### `feedback_attachments`
```
id | feedback_id (FK, ON DELETE CASCADE) | file_name (UUID.webp) | mime | size | width | height
```
Soubory v `<data>/feedback-attachments/`; při mazání připomínky je maže `deleteAttachmentFiles()`.

### `feedback_votes`
```
feedback_id (FK, ON DELETE CASCADE) | voter_hash (SHA-256 kódu z prohlížeče) | created_at | value (1 = 👍, -1 = 👎)
PRIMARY KEY (feedback_id, voter_hash)
```
Hlasovat jde o položky „Co chystáme“ a „Připomínek ostatních“ (ne skryté, jen new/read/planned).

### `pizza_orders`, `pizza_order_rows`, `pizza_items`
Analogická struktura k oběd objednávkám, bez oddělení.

### Další tabulky
`push_subscriptions` (endpoint, p256dh, auth), `telegram_subscriptions`,
`closures` (dovolené), `menu_day_closed`. Přesné sloupce viz `lib/db.ts`.

---

## Klíčové toky

### Objednávka obědů
1. `app/page.tsx` (server) volá `getTodayOrderData()` → předá do `OrderPage` (client)
2. Přidání řádku: `actionAddRow` → `addOrderRow()` → broadcast SSE
3. Editace řádku: modal `order/OrderEditModal.tsx` → `actionUpdateRow` → optimistický update + server confirm
4. Odeslání: `actionSendOrder` → `sendOrder()`:
   - Atomický `UPDATE WHERE status = 'draft'` (ochrana před dvojím odesláním)
   - `buildOrderEmail()` → HTML
   - `buildDepartmentPdfAttachment()` → PDF per oddělení
   - `sendEmail()` → nodemailer
   - Při SMTP chybě: revert na draft, throw → uživatel vidí chybu
   - Po úspěchu `sendOrderSentPush()` bez await — push těm, kdo mají v objednávce řádek

### Real-time synchronizace (SSE)
- Klient otevře `EventSource("/api/sse")` — drží spojení (ping každých 20s)
- Server Actions volají `broadcast()` po každé mutaci
- Klient přijme `event: change` → fetch `/api/order-refresh` → setState
- Logika je v `order/useOrderSync.ts`: reconnect s odstupem, refresh po návratu na kartu
  po delší pauze a po obnovení spojení, celé načtení stránky při změně dne

### PWA (appka z plochy)
- `app/manifest.ts` + `appleWebApp` v `layout.tsx`; ikony a iOS úvodní obrazovky generují routy z `lib/pwa-assets.ts`
- `public/sw.js`: push notifikace a offline fallback. Cachuje **jen** `offline.html` a zachytává jen načtení stránky — appka, API ani SSE se necachují
- Offline stránka ukáže poslední stav dnešní objednávky ze snímku v localStorage (`offlineOrderSnapshot`, ukládá `order/offline-snapshot.ts`)
- Push: zvonek na hlavní stránce → `/api/push`; připomínka před uzávěrkou (scheduler, jen kdo ještě neobjednal) a „Objednávka odeslána“
- iOS: stavový řádek má styl `default` a u horní hrany leží fixed pruh v plné barvě (`.status-bar-fill`). S `black-translucent` kreslí iOS 26+ přes horní okraj appky rozostření, které CSS vypnout neumí
- iOS a obsah pod stavovým řádkem: WebKit počítá výšku dokumentu bez horní safe area (webkit.org/b/236445). Proto `html` v `display-mode: standalone` roste o `safe-area-inset-top` a `.k-shell` je `position: fixed; inset: 0`

### Auto-odesílání
- `instrumentation.ts` → `startScheduler()` při startu Node.js
- Cron každou minutu: enabled? čas (Praha TZ)? den v týdnu? status != sent? zavřeno? minOrders?
- Zavřené dny: detekce z `todayMenu.meals/soups` — položka s názvem "Zavřeno"
- `sendOrder(id, email, "auto")` → loguje `auto_send`

### Připomínky
- `/pripominky` → `POST /api/feedback` (multipart, veřejné): honeypot `website`, zod validace, rate limit 5/h na IP + 100/den globálně, screenshoty přes `processImage()` (sharp → WebP bez metadat)
- Screenshoty pro správce: `GET /api/feedback/attachments/[id]` s hlavičkou `x-settings-pin`
- Moje připomínky: `POST /api/feedback/mine` s tajnými kódy z localStorage (`myFeedback`)
- Hlasování: `POST /api/feedback/vote` `{ id, voter, value: 1|-1|0 }` (kód hlasujícího `feedbackVoter`, vlastní hlasy `feedbackVotes` v localStorage)
- Vlastní návrh správce: `actionAddProposal(pin, { title, category })`; skrytí: `actionUpdateFeedback(pin, id, { hidden })`; sloučení duplicit: `actionMergeFeedback(pin, sourceId, targetId)`
- Stažení vlastní připomínky: `POST /api/feedback/withdraw` `{ id, token }` (jen new/read/planned a ne cílová sloučení)
- Odznak nové odpovědi v menu: `feedback/useFeedbackBadge.ts` + `feedback-seen.ts` (localStorage `feedbackSeen`, cache `feedbackMineCache` v sessionStorage)
- Předání k řešení: `lib/feedback-export.ts` (zadání pro AI, odkaz na nový GitHub issue se značkou), `lib/feedback-github.ts` (párování s úkoly přes GitHub API, `actionSyncFeedbackIssues`)
- Pozvánka na objednávkové stránce: `order/FeedbackNudge.tsx` (skrytí na 14 dní v localStorage)
- Úklid: `cleanupOldAttachments()` ve scheduleru ve 3:30 — screenshoty 90 dní po vyřízení
- Upozornění: `sendTelegramFeedbackNotification()` — jen admini s `notify_feedback = 1` (opt-in, výchozí 0)
- Správa: Nastavení → Připomínky; `actionGetFeedback/UpdateFeedback/DeleteFeedback(pin, …)` ověřují PIN přes `verifySettingsPin()` se zámkem po 10 chybách

### Nastavení a PIN
- Stránka `/nastaveni` chráněna PINem (SHA-256 hash, plain fallback pro první spuštění)
- DB hodnoty mají přednost před env proměnnými
- Správa oddělení: soft delete (`active=0`); nelze smazat dept s dnešními draft objednávkami
- Smazané oddělení zůstane viditelné v historii — `getOrderData()` doplní přes `getDepartmentByName()`

---

## Design systém

Světlý „skleněný“ vzhled v teplých tónech. Tmavý režim není.

### CSS proměnné (`:root` v `globals.css`)
```css
--bg: #f8f4ef        /* pozadí; stejná barva je v manifestu a themeColor */
--ink: #1a1208       /* text */
--ink-2: #3d2c1a  --ink-3: #7a6552  --muted: #9b8474
--divider: rgba(26,18,8,0.08)
--nav-bottom         /* odsazení mobilní navigace od spodní hrany (safe area) */
```
Akcent je jantarovo-oranžový přechod `#F59E0B → #EA580C`. Většina barev je zapsaná
přímo v komponentách (Tailwind `stone-*` a inline `style`), ne přes proměnné.

### Fonty
- Nadpisy (`.font-display`): **Plus Jakarta Sans**
- Tělo: **Inter**
- Emoji: self-hosted Noto Color Emoji (`.emoji`; na Apple zařízeních má přednost systémové)

### Hlavní CSS třídy
```
k-shell             obal stránky (fixed; vlevo místo pro sidebar na desktopu)
stage-bg, orb-*     pozadí s barevnými skvrnami
topbar              pruh záhlaví stránky
desktop-sidebar     postranní navigace (≥ 768px)
mobile-nav, mobile-nav__*   plovoucí spodní navigace na mobilu (lišta, pilulka, nabídka „Více“)
pb-nav              spodní odsazení obsahu kvůli mobilní navigaci
glass, glass-card, glass-soft, glass-btn(-danger), glass-dim   skleněné plochy a tlačítka
modal-overlay/sheet modální dialog (na mobilu bottom sheet); modal-* jeho části
confirm-dialog      potvrzovací dialog
k-toast, k-offline  toast a pruh „odpojeno“
install-hint        nabídka „přidat na plochu“
stepper-btn/count   +/- stepper pro počty příloh
row-menu-*          kontextové menu řádku (tři tečky)
fb-*                stránka připomínek
```

### Mobile
- Pod 768px mizí sidebar a nastupuje plovoucí spodní navigace
- Vše ukotvené dole počítá s `--nav-bottom`; nahoře má `.k-shell` podklad pod stavový řádek
- iOS Safari: `overflow: clip` místo `overflow: hidden` uvnitř scrollable containerů

---

## Nastavení (AppSettings)

Všechna pole jsou string (čísla jako "30", bool jako "true"/"false").

```
smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpReplyTo, smtpSecure
orderEmailTo      — výchozí příjemce; env ORDER_EMAIL_TO
cutoffTime        — "HH:MM", výchozí "08:00"
settingsPin       — SHA-256 hash; env SETTINGS_PIN / výchozí "1234"
defaultSoupPrice  — "30"
defaultMealPrice  — "110"
priceRoll/BreadDumpling/PotatoDumpling/Ketchup/Tatarka/Bbq — ceny příloh
autoSendEnabled   — "true"/"false"
autoSendTime      — "HH:MM"
autoSendDays      — "Po,Ut,St,Ct,Pa"
autoSendMinOrders — "1"
```

---

## Důležité detaily

- Bez autentizace — pouze PIN pro Nastavení
- SQLite soubor: `DB_PATH` env nebo `./data/stros.db` — nutno mountovat jako Docker volume
- Timezone: vše v `Europe/Prague`; server může být UTC
- Rate limiting: klíč = IP adresa
- PDF název souboru: slug z názvu oddělení (NFD normalizace, diakritika → ASCII)
- `computeRowPrice()` běží optimisticky na klientovi i autoritativně na serveru
- Objednávka se vytvoří automaticky při prvním `getTodayOrderData()` daného dne
