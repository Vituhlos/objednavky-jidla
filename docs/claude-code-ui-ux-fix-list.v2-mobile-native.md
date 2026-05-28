# Claude Code – UI/UX Fix List v2 (Mobile native feel + PWA)

Tahle verze je **nová sada návrhů** zaměřená na to, aby se appka na telefonu (v browseru i jako instalovaná PWA) chovala co nejvíc „nativně“.
Neobsahuje implementaci, jen konkrétní, proveditelné návrhy + kde v kódu na to sáhnout.

---

## 1) PWA / install / offline očekávání (realita vs. pocit nativní appky)

### 1.1 Service worker dnes nedělá offline appku (a může působit „nestabilně“)
- **Co je teď**:
  - `public/sw.js` při `activate` maže **všechny cache**.
  - Neexistuje žádné `fetch` handler caching strategie → offline režim není PWA-like.
  - `SwRegister` registruje SW a v komentáři je explicitně: „sám odregistruje a smaže cache“.
- **Dopad na mobile feel**:
  - uživatel čeká „app“ chování po instalaci, ale offline/poor network nemá hladký fallback.
  - může to působit jako „PWA je jen zástupce“.
- **Návrh**:
  - rozhodnout, jestli PWA má být jen „shell + push“ nebo i offline.
  - pokud má být offline-friendly: doplnit `fetch` handler se strategií (např. stale-while-revalidate pro statické assety, network-first pro API s fallbackem na cache).
  - pokud offline být nemá: explicitně to odkomunikovat v UI (banner v offline, co je omezené).
- **Soubory**: `public/sw.js`, `app/components/SwRegister.tsx`

### 1.2 Manifest: doplnit „maskable“ icon + app shortcuts (pocit „nativní aplikace“)
- **Co je teď**: `app/manifest.ts` má `display: "standalone"`, 2 ikony, bez `purpose: "maskable"`.
- **Návrhy**:
  - přidat icon variantu s `purpose: "maskable"` (Android launcher).
  - přidat `shortcuts` (např. „Dnešní objednávka“, „Jídelníček“, „Historie“, „Pizza“ pokud enabled).
  - zvážit `display_override: ["window-controls-overlay", "standalone"]` (pokud chcete extra app feel na podporovaných UA).
- **Soubor**: `app/manifest.ts`

---

## 2) „Native“ modal sheet na mobilu (hlavní věc pro app feel)

### 2.1 Sheet při drag-to-dismiss má jezdit s prstem (ne fadeovat)
- **Co je teď**: `useModalSwipe` během `touchmove` snižuje `el.style.opacity` → sheet „bledne“.
- **Návrh**: sheet držet neprůhledný, posouvat jen `translateY`; fade aplikovat na overlay podle progresu.
- **Soubory**:
  - `app/hooks/useModalSwipe.ts`
  - místa použití: `OrderPage`, `MenuPage`, `DepartmentPanel`, `SettingsPage`, `PizzaPage`

### 2.2 Při puštění prstu: dokončit animaci a zavřít až po ní (transitionend)
- **Co je teď**: `setTimeout(..., 200)` a pak `onDismiss()` → může „cvaknout“ podle framerate.
- **Návrh**:
  - zavírat po `transitionend` na sheet/overlay (s fallback timeoutem).
  - umožnit „spring back“ návrat s lehkým overshootem (iOS-like).
- **Soubor**: `app/hooks/useModalSwipe.ts`

### 2.3 „Handoff“ mezi scroll a drag (iOS-like)
- **Co je teď**: pokud `.modal-sheet__body.scrollTop > 0`, gesture patří scrollu a sheet se netáhne (OK), ale přechod je ostrý.
- **Návrh**:
  - pokud je scroll na topu a user táhne dolů, plynule přepnout do drag režimu.
  - vyhnout se situaci „drag nic nedělá“ v momentě, kdy scroll dojede na 0 uprostřed gesta.
- **Soubor**: `app/hooks/useModalSwipe.ts`

---

## 3) Touch / scroll / iOS Safari detaily (nejčastější „nenativní“ drobnosti)

### 3.1 Body scroll lock konzistence (jedno místo, jednotné chování)
- **Co je teď**: např. `OrderPage` HelpModal fixuje `body` přes `position: fixed` hack (kvůli iOS).
- **Návrh**:
  - vyrobit 1 shared helper/hook pro scroll-lock (uložení scrollY + restore), používat ve všech modalech.
  - tím se sjednotí chování napříč modaly a zmizí edge-case bugy.
- **Soubory**:
  - `app/components/OrderPage.tsx` (HelpModal)
  - další modaly v `MenuPage`, `OrderDetailPage`, `SettingsPage` atd.

### 3.2 Pull-to-refresh a „rubber band“ (web vs app feel)
- **Návrh**:
  - u hlavních scroll containerů zvážit `overscroll-behavior: contain` (už je u `.scroll-area`), ale ověřit, že je aplikovaný všude, kde je scroll (někde může být jiný wrapper).
  - případně v PWA (standalone) potlačit pull-to-refresh tam, kde to působí rušivě.
- **Soubor**: `app/globals.css` (`.scroll-area`, `.k-shell`, modal body)

### 3.3 Tap feedback a selekce textu
- **Návrh**:
  - sjednotit `-webkit-tap-highlight-color: transparent;` pro ikonová tlačítka / navigaci (aby to nebylo „browser blue flash“).
  - u „klikacích řádků“ zakázat dlouhý text selection (už někde je `select-none`, ale ne všude).
- **Soubor**: `app/globals.css` + komponenty se seznamy (`HistoryPage`, `MenuPage`, `OrderPage`)

---

## 4) Navigace na mobilu jako „app“ (safe area, bottom nav, focus)

### 4.1 Bottom nav: safe-area + interakce s modaly
- **Co je teď**: bottom nav je fixed a `.pb-nav` řeší padding pro obsah.
- **Návrhy**:
  - explicitně definovat, že při otevřeném modalu bottom nav je „pod“ overlay (z-index/stacking).
  - u modalů zajistit, aby swipe-down neinteragoval s bottom nav (touch hit testing).
- **Soubory**: `app/globals.css`, `app/components/AppTopBar.tsx`, modal overlay z-index pravidla

### 4.2 „Back“ chování (uživatelská kontrola)
- **Návrh**:
  - pro velké modaly zvážit, zda mají být routované (URL state) → umožní nativní back gesture (Android) / back button.
  - minimálně u některých modalů (import preview, detail edit) zvážit route-based sheet.
- **Soubory**: `MenuPage` import/edit, `DepartmentPanel` edit row, `OrderDetailPage` preview

---

## 5) Animace a přechody mezi stránkami (app feel)

### 5.1 View Transitions (pokud targetujete moderní Chromium/Safari)
- **Návrh**:
  - pro hlavní navigaci (tab switch) použít View Transitions API (soft fade/slide).
  - nebo aspoň sjednotit page enter animace (teď je mix `fade-up`, `slide-in`, někde nic).
- **Soubory**: `app/globals.css` (animace), navigační přechody v top-level pages/components

### 5.2 Reduced motion
- **Co je teď**: `prefers-reduced-motion` je v `globals.css` (dobře).
- **Návrh**:
  - u swipe modalu respektovat reduced motion (žádný spring/overshoot).
- **Soubor**: `useModalSwipe.ts` + CSS transitions

---

## 6) „App-like“ feedback (stav, haptics náhražky, mikrocopy)

### 6.1 Loading a pending stavy
- **Návrh**:
  - sjednotit loading: inline spinner v buttonu vs text „…“ (teď je to mix).
  - u akcí, které běží déle (import PDF, send), přidat progress/step status.
- **Soubory**: `MenuPage` import, `OrderPage` send, `SettingsPage` test SMTP atd.

### 6.2 Offline / reconnect UX
- **Co je teď**: `OrderPage` má offline banner (super).
- **Návrh**:
  - rozšířit offline UX i do dalších částí (menu/settings), nebo mít globální offline banner ve layoutu.
- **Soubory**: `app/layout.tsx` (ideálně), `OrderPage`

---

## 7) Doporučený plán implementace (aby to bylo „cítit“ rychle)
1) **Modal swipe overhaul** (sheet follows finger + overlay fade + transitionend close) – největší win na „native“ feel.
2) **Scroll lock sjednotit** do shared helperu (iOS).
3) **PWA polish**: maskable icon + shortcuts + rozhodnutí o offline strategii SW.
4) **Page transitions** (volitelně View Transitions) + sjednocení animací.

