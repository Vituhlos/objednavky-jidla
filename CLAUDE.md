# Kontext aplikace — Objednávky obědů a pizzy

Firemní webová aplikace pro sdílené objednávky obědů (LIMA) a pizzy.
Běží jako **jeden Docker kontejner**, bez přihlášení — přístup omezený sítí.

---

## Tech stack

| Vrstva | Technologie |
|---|---|
| Framework | Next.js 15, App Router, React 19 |
| Jazyk | TypeScript (striktní) |
| CSS | Tailwind CSS 4 + vlastní třídy v `globals.css` |
| Databáze | SQLite přes `better-sqlite3` (singleton, WAL mode) |
| E-mail | nodemailer |
| PDF export | pdfkit |
| PDF import | pdf-parse |
| Scheduler | node-cron (spouštěn přes `instrumentation.ts`) |
| Real-time | SSE (Server-Sent Events) |
| Runtime | Node.js 24, Docker |

---

## Struktura projektu

```
app/
  page.tsx                         # Hlavní stránka — dnešní objednávka obědů
  layout.tsx                       # Root layout
  error.tsx                        # Error boundary
  actions.ts                       # Všechny React Server Actions
  globals.css                      # Veškeré CSS

  components/
    AppTopBar.tsx                  # Horní navigace (všechny stránky)
    OrderPage.tsx                  # Klientská komponenta hlavní stránky
    DepartmentPanel.tsx            # Panel oddělení + modální editace řádku
    OrderDetailPage.tsx            # Read-only detail historické objednávky
    HistoryPage.tsx                # Seznam historických objednávek
    MenuPage.tsx                   # Správa jídelníčku (import PDF, editace)
    PizzaPage.tsx                  # Objednávky pizzy
    PizzaDetailPage.tsx            # Detail historické pizza objednávky
    SettingsPage.tsx               # Nastavení (PIN chráněno)

  api/
    sse/route.ts                   # SSE endpoint — push změn klientům
    order-refresh/route.ts         # GET — aktuální stav objednávky (pro SSE)
    backup/route.ts                # GET — JSON export celé databáze
    smtp-test/route.ts             # POST — test SMTP s hodnotami z formuláře
    menu/import/route.ts           # POST — ruční přidání položky jídelníčku
    menu/pdf/[weekStart]/route.ts  # POST — import jídelníčku z PDF
    pizza/scrape/route.ts          # GET — scraping cen pizzy z webu pizzerie

  historie/
    page.tsx                       # Seznam objednávek
    [id]/page.tsx                  # Detail oběd objednávky
    pizza/[id]/page.tsx            # Detail pizza objednávky

  jidelnicek/page.tsx
  pizza/page.tsx
  nastaveni/page.tsx

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

### `pizza_orders`, `pizza_order_rows`, `pizza_items`
Analogická struktura k oběd objednávkám, bez oddělení.

---

## Klíčové toky

### Objednávka obědů
1. `app/page.tsx` (server) volá `getTodayOrderData()` → předá do `OrderPage` (client)
2. Přidání řádku: `actionAddRow` → `addOrderRow()` → broadcast SSE
3. Editace řádku: modal v `DepartmentPanel.tsx` → `actionUpdateRow` → optimistický update + server confirm
4. Odeslání: `actionSendOrder` → `sendOrder()`:
   - Atomický `UPDATE WHERE status = 'draft'` (ochrana před dvojím odesláním)
   - `buildOrderEmail()` → HTML
   - `buildDepartmentPdfAttachment()` → PDF per oddělení
   - `sendEmail()` → nodemailer
   - Při SMTP chybě: revert na draft, throw → uživatel vidí chybu

### Real-time synchronizace (SSE)
- Klient otevře `EventSource("/api/sse")` — drží spojení (ping každých 20s)
- Server Actions volají `broadcast()` po každé mutaci
- Klient přijme `event: change` → fetch `/api/order-refresh` → setState

### Auto-odesílání
- `instrumentation.ts` → `startScheduler()` při startu Node.js
- Cron každou minutu: enabled? čas (Praha TZ)? den v týdnu? status != sent? zavřeno? minOrders?
- Zavřené dny: detekce z `todayMenu.meals/soups` — položka s názvem "Zavřeno"
- `sendOrder(id, email, "auto")` → loguje `auto_send`

### Nastavení a PIN
- Stránka `/nastaveni` chráněna PINem (SHA-256 hash, plain fallback pro první spuštění)
- DB hodnoty mají přednost před env proměnnými
- Správa oddělení: soft delete (`active=0`); nelze smazat dept s dnešními draft objednávkami
- Smazané oddělení zůstane viditelné v historii — `getOrderData()` doplní přes `getDepartmentByName()`

---

## Design systém

### CSS proměnné (barvy)
```css
--paper: #f3efe6     /* pozadí */
--sand:  #d8c3a5     /* bordery */
--navy:  #16324a     /* primární tmavá */
--steel: #2f4858     /* sekundární tmavá */
--graphite: #2e3338  /* text */
--rust:  #b55233     /* červenohnědá */
--amber: #c78b2a     /* žlutá */
--green: #4f6f52     /* zelená */
--v2-orange: #ea580c
--v2-text-muted: #6b7280
```

### Fonty
- Nadpisy: **Oswald** (400/500/600)
- Tělo: **Source Sans 3** (400/500/600/700)

### Hlavní CSS třídy
```
v2-shell            wrapper stránky
v2-topbar           horní nav
v2-infostrip        info pruh pod navem
v2-content          content area
v2-dept             sekce oddělení (+ --blue/rust/green)
v2-order-row        řádek objednávky (+ --interactive)
v2-statusbar        spodní stavový pruh (+ --sent)
v2-btn              tlačítka (+ --primary/secondary/danger/ghost)
v2-alert            alerty (+ --warn)
v2-navlink          nav položky (+ --active)
modal-overlay/sheet modální dialog pro editaci řádku
stepper-btn/count   +/- stepper pro počty příloh
row-menu-*          kontextové menu řádku (tři tečky)
```

### Mobile
- TopBar scrolluje horizontálně na malých displejích
- Order rows přejdou do card layoutu pod 768px
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
