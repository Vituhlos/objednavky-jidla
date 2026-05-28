# UI/UX Review v5 – po merge PR #9 (fresh pass)

Tento dokument je rychlý “post-merge” průchod zaměřený na **regrese a rizika**, plus pár **dalších quick-win polish** bodů, které se typicky projeví až na mobilu / v instalované PWA.

---

## 1) Největší riziko po merge: Service Worker (PWA cache)

### 1.1 Riziko “stará verze UI / divné chování po deployi”
V `public/sw.js` je nově runtime caching:
- **navigace**: network-first + ukládání do Cache Storage
- **assets**: cache-first

To je dobrý “native feel” krok, ale přirozeně přináší tyto edge-cases:
- po novém deployi může uživatel krátce vidět kombinaci starých/nových assetů (dokud se SW neaktualizuje + neprojde `activate`)
- cachování navigací může uložit i nechtěné response (redirecty, chybové stránky, auth mezi-stavy)

**Doporučení (bez velkého scope):**
- u navigací cachovat jen když `res.ok` (2xx) a ideálně když `res.headers.get("content-type")` obsahuje `text/html`
- zvážit “assets-only” caching (nejmenší riziko) a navigace ponechat čistě network-first bez `cache.put`

### 1.2 Cleanup cache může smazat “cizí” cache
`activate` teď maže všechny cache kromě `CACHE_NAME`. Pokud by v budoucnu appka nebo nějaká knihovna používala vlastní Cache Storage namespace, bude to smazáno.

**Doporučení:**
- mazat jen cache se prefixem, např. `kantyna-pwa-`

---

## 2) Drobná regresní nepřesnost: text v `SwRegister.tsx`

V `app/components/SwRegister.tsx` je komentář:
- “Načte sw.js, který se sám odregistruje a smaže cache”

To už po změnách neplatí (SW se naopak používá aktivně).

**Doporučení:**
- upravit komentář, aby nepletl při budoucím debugování

---

## 3) Mobile sheet modaly – stav po merge a další polish

### 3.1 Je hotovo (dobrý posun)
- `useModalSwipe.ts` má:
  - sheet jen přes `translateY` (neopacity)
  - overlay fade
  - dynamický dismiss threshold (clamp)
  - scroll↔drag handoff

### 3.2 Ještě “iOS feel” detail (volitelné)
Aktuální “spring” návrat je spíš jen rychlejší easing (`translateY(0)`) než skutečný overshoot.

**Doporučení:**
- buď 2-fázově: `translateY(10px)` → `translateY(0)` (krátké, jemné)
- nebo Web Animations API s 2 keyframes (jen pro reset, velmi krátké)

---

## 4) A11y/ARIA konzistence (stav po merge)

Pozitivní: u všech procházených sheet modalů je `aria-labelledby` vedené přes `useId()` (žádné fixní stringy).

**Doporučení (jen sanity):**
- přidat rychlý grep-check do budoucna: zda se nevrací fixní `aria-labelledby="..."`

---

## 5) Quick wins pro “app-like” polish (neblokující)

### 5.1 Safe-area konzistence
V projektu už jsou safe-area insets použité na více místech (např. bottom nav, floating bar, některé fixed prvky).

**Doporučení:**
- zkontrolovat všechny fixed overlay prvky (toasty, “just sent”, bottom nav) na iOS Safari/PWA, že:
  - nejsou pod home indikátorem
  - nejsou přes sebe ve stacku (z-index + bottom offset)

### 5.2 Back button / URL state u velkých modalů (volitelně)
Pro velké flows (např. import preview) zvažte route-based state (URL), aby se dalo zavírat back gestem.

---

## Doporučené pořadí, pokud budete ladit po nasazení
1) Pokud se objeví “stará verze UI”: nejdřív hotfix v `sw.js` (assets-only, nebo `CACHE_NAME` bump).
2) Pak jen doplnit komentář v `SwRegister.tsx` (malý commit).
3) Nakonec volitelné “spring” polish reset animace.

