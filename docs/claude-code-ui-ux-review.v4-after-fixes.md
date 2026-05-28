# UI/UX Review v4 – po zapracování fix-list v1 (fresh pass)

Tento dokument je **nový review po tom, co byly zapracované předchozí připomínky**. Záměrně **neopakuje** body z původního checklistu, jen řeší to, co zůstává / nově vyplavalo.

---

## 1) Mobile “native feel” – stav po úpravách a co zlepšit dál

### 1.1 Swipe-to-dismiss je už správným směrem (sheet jede, overlay fade)
- `app/hooks/useModalSwipe.ts` teď:
  - drží sheet neprůhledný (jen `transform`)
  - fadeuje overlay (`overlay.style.background = rgba(..., alpha)`)
  - zavírá po `transitionend` (+ timeout fallback)
- **Další návrhy na “iOS sheet feel”**:
  - **Spring návrat**: při `reset()` udělat lehké “overshoot” (např. 1–2 keyframes nebo krátká 2‑fázová animace) pro app feel.
  - **Threshold podle výšky sheetu**: `DISMISS_DISTANCE_PX` dynamicky (např. 0.22×výška sheetu), aby malé i velké modaly měly stejný pocit.
  - **Handoff scroll ↔ drag**: teď se drag vypne, když `.modal-sheet__body.scrollTop > 0`. Zvážit plynulejší přepnutí, když scroll dojede na 0 uprostřed gesta.

### 1.2 Focus trap je zavedený, ale není sjednocený napříč všemi modaly
- Existuje `app/hooks/useFocusTrap.ts` a některé modaly už ho používají (např. HelpModal v `OrderPage`, edit modal v `MenuPage`).
- `ConfirmModal` má vlastní focus trap logiku inline (funguje), ale tím vznikají 2 různé implementace.
- **Návrh**:
  - sjednotit: `ConfirmModal` může použít `useFocusTrap(dialogRef, mounted)` a zjednodušit kód
  - ideálně vyrobit 1 sdílenou “ModalShell/SheetModal” komponentu (overlay + sheet + focus trap + restore focus + Escape + click-outside).

---

## 2) ARIA/id konzistence v modalech (nově viditelný detail)

### 2.1 Některé sheet modaly mají stále fixní `aria-labelledby` id stringy
- Příklad: `OrderPage` HelpModal používá `aria-labelledby="help-modal-title"` a `id="help-modal-title"`.
- Příklad: `MenuPage` item edit modal používá `aria-labelledby="item-edit-modal-title"`.
- To je ok, pokud nikdy nemohou být otevřené současně, ale obecně je bezpečnější mít unikátní ID.
- **Návrh**:
  - přejít na `useId()` pro `aria-labelledby`/`id` v modalech (stejně jako to už dělá `ConfirmModal`).
- **Soubory k projití** (modaly/sheets):
  - `app/components/OrderPage.tsx` (HelpModal)
  - `app/components/MenuPage.tsx` (edit/import modaly)
  - `app/components/SettingsPage.tsx` (help sheets)
  - `app/components/OrderDetailPage.tsx` (email preview modal)

---

## 3) PWA očekávání vs realita (ještě pořád největší “app gap” mimo UI)

### 3.1 Service worker je stále “push-only” a maže cache při activate
- `public/sw.js`:
  - maže všechny cache při `activate`
  - nemá `fetch` handler → offline není podporovaný
- `app/components/SwRegister.tsx` registruje SW bez další logiky.
- **Návrh**:
  - rozhodnout produktově:
    - **A) “Shell + push”**: SW jen pro push. Pak *nemazat* cache agresivně (nebo mít jasný důvod) a v UI komunikovat omezení offline.
    - **B) “Offline-friendly PWA”**: přidat `fetch` handler a caching strategii (assets vs API), plus offline fallback UI (aspoň pro read-only části).

### 3.2 Manifest polish (maskable + shortcuts) – rychlý “native” win
- Pokud ještě není: doplnit `maskable` icon a `shortcuts` (Dnešní objednávka / Jídelníček / Historie / Pizza).
- **Soubor**: `app/manifest.ts`

---

## 4) Konzistence UI primitives – co zůstalo po refaktorech

### 4.1 “Design tokens” se začaly centralizovat (dept-colors), dotáhnout do konce
- Nově existuje `app/components/dept-colors.ts`.
- **Návrh**:
  - zkontrolovat, že všechny stránky používají tento zdroj (detail pages, historie badge, department panel).
  - totéž pro “brand” tokeny (gradient/shadow) – v `globals.css` už jsou utility (např. `brand-grad`), ale ještě zůstává inline stylování na různých místech.

### 4.2 Typografická škála
- Po změnách už je vidět posun směrem k `text-[13px]` jako standard.
- **Návrh**:
  - definovat 4–6 velikostí a konzistentně je používat (meta/body/title/number).
  - následně to zjednoduší údržbu a sjednotí “app feel”.

---

## 5) Další kandidáti na “app-like” polish (quick wins)

### 5.1 Overlay stack & safe-area
- Ujistit se, že všechny fixed prvky (toasty, offline banner, justSent toast) mají konzistentní offsety a respektují safe-area (top i bottom).

### 5.2 Route-based modals u vybraných flow
- Pro některé modaly (import preview, velké editace) zvážit route‑based (URL state) kvůli back buttonu/gesture v mobilu.

---

## Doporučené pořadí dalších kroků
1) Unikátní `aria-labelledby` ID v sheet modalech (useId) + sjednotit modal shell pattern.
2) PWA rozhodnutí (push-only vs offline-friendly) + upravit `sw.js` podle toho.
3) Overlay stack + safe-area sjednocení.
4) Dokončit centralizaci tokenů (brand + dept) a typografické škály.

