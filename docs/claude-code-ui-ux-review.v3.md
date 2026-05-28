# UI/UX Review v3 – Kantýna (web + PWA, mobile-first)

Tenhle dokument je **pořádný, systematický review** chování appky (statická analýza kódu). Je psaný tak, aby se dal rovnou rozsekat na úkoly.

> Pozn.: Nejde o live dogfooding (bez reálného klikání), ale o “code-informed UX review”.

---

## Executive summary (co je na appce silné vs. kde to “nepůsobí jako appka”)

### Co je už teď velmi dobré
- **Dobrá práce s “app chrome” na mobilu**: fixed bottom nav + `pb-nav` padding + `.k-shell` s `100dvh` a vlastní scroll container.
- **Viditelnost stavu** (Nielsen H1): SSE connected dot, offline banner, toast “řádek smazán” se zpět, urgentní countdown banner.
- **Práce s empty states**: konzistentní `.empty-state` komponentový pattern.

### Co nejvíc kazí “native app feel”
- **Sheet modaly při swipu blednou** (opacity na sheet), místo aby jely s prstem + overlay fadeoval.
- **Modal infra není jednotná**: focus trap/restore, unikátní aria ID, scroll-lock hacky jsou “per-modal” a ne centrálně.
- **PWA SW dnes není offline-friendly** a navíc při activate maže caches → instalace může působit “jen jako zástupce”.

---

## Hlavní user flow review

### 1) Objednávka (Home / `OrderPage`)
**Silné stránky**
- **SSE + offline banner** je výborný “app-like” feedback.
- **Undo delete** (toast) je dobré H3 (user control).
- **Day picker**: desktop tabs + mobile dots + swipe mezi dny (super “native”).

**Rizika / návrhy**
- **Primární CTA “Odeslat” je ručně stylovaný** (gradient + shadow inline) a jinde se používá `modal-btn--primary`.
  - Návrh: sjednotit CTA styl a radius (pill vs 14px) do jasných variant (viz D3/D1 v prvním checklistu).
- **Toast a bannery mají různé z-index a pozicování** (např. `top-16` pro “Objednávka odeslána”) – v PWA standalone mohou kolidovat se safe-area / status bar.
  - Návrh: udělat 1 “overlay stack” pravidlo (toast/alert/modal/nav) a sjednotit offsety pomocí safe-area env.
- **Auto-send error banner**: text je truncate (mobil) a může zamlčet příčinu.
  - Návrh: “expand” / “detail” v modalu nebo “tap to see full”.

**Soubor**: `app/components/OrderPage.tsx`, styly v `app/globals.css`

### 2) Department edit modal (row edit) – `DepartmentPanel`
**Silné stránky**
- Custom `MenuSelect` má dobré “combobox/listbox” role a vrací focus na trigger (pozitivní).

**Rizika / návrhy**
- **Select/dropdown infra se duplikuje** (MenuSelect vs pizza select vs `.k-select`).
  - Návrh: sdílená komponenta pro floating listbox container (radius, shadow, backdrop, item styles).
- **Sheet swipes** (useModalSwipe) → stejný “fade sheet” problém pro všechny row edit modaly.

**Soubor**: `app/components/DepartmentPanel.tsx`, hook `app/hooks/useModalSwipe.ts`

### 3) Jídelníček (`MenuPage`)
**Silné stránky**
- Desktop grid + tablet horizontal snap + mobile single-day view je UXově promyšlené.
- Allergen filter je dobrý “power feature”.

**Rizika / návrhy**
- **Allergen filter semantika**: button + checkbox uvnitř s `tabIndex={-1}` (už v checklistu).
- **Import modal**: je komplexní flow – pro “app feel” by pomohl “stepper” a konzistentní progress (uploading → preview → saving).
- **Edit mód**: mix “přidat” plus button v headeru sekce a další CTA – dobré, ale chtělo by sjednotit feedback po uložení/smazání (toasty).

**Soubor**: `app/components/MenuPage.tsx`

### 4) Historie (`HistoryPage`)
**Silné stránky**
- KPI cards + filter chips + calendar heatmap: dobrá informační architektura.
- Shortcut `Ctrl/⌘K` na search je super H7.

**Rizika / návrhy**
- **Clickable rows v tabulce**: `role="link"` + `tabIndex`, ale ne všude Space/Enter konzistentně (pizza rows chybí keyboard handler).
- **Calendar heatmap**: je button grid, což je ok; pro app feel by se hodilo “haptic-like” micro feedback (scale) je už v CSS, dobré.

**Soubor**: `app/components/HistoryPage.tsx`

### 5) Detail (obědy/pizza) – `OrderDetailPage` / `PizzaDetailPage`
**Silné stránky**
- `PageHeader` s `secondaryRow` řeší mobile vs desktop hezky.

**Rizika / návrhy**
- **Duplikované `DEPT_COLORS`** (v detailu i panelu) → drift barev v čase.
  - Návrh: vyextrahovat tokeny do 1 souboru.
- **Modal preview** (email preview) v `OrderDetailPage` používá `aria-labelledby` fixed id – duplicity riziko.

**Soubory**: `app/components/OrderDetailPage.tsx`, `app/components/PizzaDetailPage.tsx`

### 6) Nastavení (`SettingsPage`)
**Silné stránky**
- PIN unlock + session timeout je dobrý model pro admin-only settings.
- Důsledně řeší “health check” a testovací akce (SMTP/IMAP/webhook).

**Rizika / návrhy**
- **Soubor je extrémně velký** (maintenance + UX konzistence riziko).
  - Návrh: rozdělit na sub-komponenty podle tabů a sdílet UI primitives (alerts, buttons, section headers).
- **Help sheets** používají `useModalSwipe` → stejný “native feel” problém.
- **Save status**: je state `saveStatus`, ale pokud je i floating save FAB (`.settings-save-fab`), zkontrolovat konzistenci kdy se ukazuje a jak “saved/error” vypadá.

**Soubor**: `app/components/SettingsPage.tsx`

### 7) Auth flows (login/registrace/forgot/reset)
**Silné stránky**
- UI je velmi čisté, glass-card, jasné CTA.

**Rizika / návrhy**
- **Eye button `tabIndex={-1}`** (už v checklistu) – klávesnice.
- **Inline toast z URL params**: ok, ale sjednotit styl s ostatními alerty (např. `k-toast`/alert component).

**Soubory**: `app/login/page.tsx`, `app/registrace/RegistraceForm.tsx`, `app/zapomenute-heslo/page.tsx`, `app/reset-hesla/page.tsx`

---

## Mobile + PWA “native feel” review

### A) Scroll model: “app shell” se scroll-area (dobře) + kde to může drhnout
- `html, body { overflow: hidden }` + `.scroll-area { overflow-y: auto }` je dobré pro app feel.
- Potenciální problém: různé stránky používají různé wrappery → ověřit, že **vždy** existuje jen jeden scroll container, jinak vznikají “double scroll” bugy na iOS.

### B) Safe-area a fixed prvky
- `.pb-nav` řeší padding pro bottom nav i safe-area – super.
- Návrh: sjednotit i top safe-area pro bannery/toasty (např. offline banner, justSent toast).

### C) Modaly / sheets (největší win)
- Změnit `useModalSwipe` dle návrhu v `claude-code-ui-ux-fix-list.md` sekce **B3**:
  - sheet neprůhledný
  - overlay fade podle progress
  - close po transitionend
  - scroll↔drag handoff

### D) PWA (install)
- `manifest.ts` je OK (standalone), ale:
  - doporučit `maskable` icon
  - shortcuts
- Service worker:
  - `public/sw.js` dnes nemá offline strategii (a ještě maže caches).
  - rozhodnout očekávání: “shell-only” vs “offline-friendly”.

Soubory: `app/manifest.ts`, `public/sw.js`, `app/components/SwRegister.tsx`

---

## Konzistence UI systému (kde vzniká drift)

### 1) Inline stylování (gradient/shadow/radius) vs. utility třídy
- V kódu je hodně `style={{ background: "linear-gradient(...)", boxShadow: ... }}`.
- Návrh: převést na 2–4 utility třídy a 1 “token” soubor (dept colors).

### 2) Typografické mikro-varianty
- Příliš mnoho `text-[11.5px]`, `text-[12.5px]`, `text-[13px]`.
- Návrh: zvolit škálu + mapování “meta/body/title”.

### 3) Select/dropdown patterns
- `MenuSelect` (DepartmentPanel), pizza select (PizzaPage), `.k-select`.
- Návrh: sjednotit do jedné komponenty a jedné vizuální “dropdown surface”.

---

## Prioritizace (doporučené pořadí)
1) **Native modal swipe** (sheet follows finger + overlay fade + transitionend close) – největší app feel win.
2) **Modal infra**: focus trap + restore focus + unikátní aria IDs (globální pattern).
3) **PWA polish**: maskable icon + shortcuts + rozhodnutí o SW strategii.
4) **Design drift**: CTA/button unify + dept tokens unify + dropdown unify.
5) **Keyboard parity**: clickable rows (Enter+Space) + show/hide password focus.

