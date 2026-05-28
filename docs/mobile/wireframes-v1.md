# Mobile app wireframes v1

Low-fi wireframes for the native iOS (SwiftUI) + Android (Compose) companion app.

**Decisions locked in v1:**
- Hybrid navigation: 4 bottom tabs + Settings under Profile
- Platform-native look (Material 3 / HIG), brand accent `#EA580C`
- `Oběd` tab uses **department cards** (not a flat row list)
- QR use-case: **device pairing / quick login** (one-time token from web)

---

## Global navigation

```
┌─────────────────────────────────────┐
│  [screen content]                   │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  🍽 Oběd   📋 Jídelníček   🕐 Hist  👤 Profil │
└─────────────────────────────────────┘
```

| Tab | Primary task |
|-----|--------------|
| Oběd | Today's order — add/edit rows, send (admin) |
| Jídelníček | Browse weekly menu |
| Historie | Past sent orders |
| Profil | Account, push, settings entry, logout |

Secondary screens (Settings, Help, QR scan) push onto the Profile stack or present as sheets.

---

## 1. Oběd (daily ordering)

### 1.1 Main screen

```
┌─────────────────────────────────────┐
│ Oběd                    [offline ⓘ] │
├─────────────────────────────────────┤
│  ◀  St 28. 5.   Dnes  Po 29. 5.  ▶  │  ← day switcher (chips)
├─────────────────────────────────────┤
│ ⏱ Objednávka do 08:00  (zbývá 1:24) │  ← cutoff banner (amber if close)
├─────────────────────────────────────┤
│ ┌─ Konstrukce ──────────── 420 Kč ─┐│
│ │ ● Draft · 2 osoby                 ││
│ │ Jan Novák — Polévka A, Jídlo 1    ││
│ │ Marie Nová — Polévka B, Jídlo 2   ││
│ │         [Upravit]  [+ Přidat]     ││
│ └───────────────────────────────────┘│
│ ┌─ Dílna ───────────────── Empty ───┐│
│ │ Žádné objednávky                  ││
│ │              [+ Přidat]           ││
│ └───────────────────────────────────┘│
│ ┌─ Kanceláře ───────────── Sent ────┐│  ← read-only if order.status=sent
│ │ 3 osoby · odesláno 07:58          ││
│ │              [Zobrazit]           ││
│ └───────────────────────────────────┘│
├─────────────────────────────────────┤
│ Celkem: 1 240 Kč                    │
│ [ Odeslat objednávku ]              │  ← admin only; disabled if empty/offline*
└─────────────────────────────────────┘
```

\* Offline: show banner “Offline — změny se odešlou po připojení”. Draft edits allowed; **Send** queues in outbox (admin) or stays disabled until online (configurable in v1 — default: queue for admin).

**Department card states**

| State | Visual | Actions |
|-------|--------|---------|
| Empty | muted border, “Empty” badge | `+ Přidat` |
| Draft | accent border, row previews | `Upravit`, `+ Přidat`, swipe row → delete |
| Sent | greyed, “Sent” badge + `sentAt` | read-only `Zobrazit` |

Card accent color maps from `DepartmentInfo.accent` (blue, rust, green, …).

### 1.2 Edit row — native bottom sheet

Opened from `+ Přidat` or tap on existing row.

```
        ─── drag handle ───
┌─────────────────────────────────────┐
│ Upravit objednávku          [Zavřít]│
├─────────────────────────────────────┤
│ Oddělení: Konstrukce          ▼     │
│ Jméno:    [ Jan Novák          ]    │
│                                     │
│ Polévka 1   [ A — Hovězí vývar  ▼ ] │
│ Polévka 2   [ — žádná —         ▼ ] │
│ Hlavní jídlo[ 1 — Kuřecí řízek  ▼ ] │
│ Počet jídel [ 1 ]                   │
│                                     │
│ ▼ Přílohy a omáčky                  │
│   Rohlík [0]  Knedlík [0]  …        │
│                                     │
│ Poznámka  [                        ]│
├─────────────────────────────────────┤
│ [ Smazat ]          [ Zrušit ] [Uložit]│
└─────────────────────────────────────┘
```

**Interactions**
- Swipe down dismisses sheet (iOS interactive dismiss / Android back).
- On dismiss **without Save**: discard unsaved draft row (no ghost empty row — unlike web bug).
- `Uložit` → PATCH row via API; optimistic UI + outbox if offline.
- `Smazat` → confirmation dialog → DELETE row.

### 1.3 Send confirmation (admin)

```
┌─────────────────────────────────────┐
│ Odeslat objednávku?                 │
│                                     │
│ Po 29. 5. · 8 osob · 1 240 Kč       │
│ E-mail bude odeslán na kuchyni.     │
│                                     │
│        [ Zrušit ]    [ Odeslat ]    │
└─────────────────────────────────────┘
```

After send: cards switch to Sent state; toast “Objednávka odeslána”.

---

## 2. Jídelníček (menu browse)

```
┌─────────────────────────────────────┐
│ Jídelníček                          │
├─────────────────────────────────────┤
│ Týden od 26. 5.               ▼     │
│  Po   Út   St   Čt   Pá            │  ← day tabs
├─────────────────────────────────────┤
│ 🔍 Hledat jídlo…                    │
├─────────────────────────────────────┤
│ POLÉVKY                             │
│  A  Hovězí vývar        30 Kč       │
│     alergeny: 1, 3, 9               │
│  B  Zelňačka            30 Kč       │
├─────────────────────────────────────┤
│ JÍDLA                               │
│  1  Kuřecí řízek       110 Kč       │
│     alergeny: 1, 3                  │
│  2  Svíčková           110 Kč       │
│                                     │
│  [tap row → detail sheet]           │
└─────────────────────────────────────┘
```

### Menu item detail sheet

```
┌─────────────────────────────────────┐
│ Kuřecí řízek                        │
│ Jídlo 1 · 110 Kč                    │
│ Alergeny: 1, 3, 9                   │
│                                     │
│ [ Předvyplnit do objednávky ]       │  → switches to Oběd tab + opens edit sheet
└─────────────────────────────────────┘
```

---

## 3. Historie

### 3.1 List

```
┌─────────────────────────────────────┐
│ Historie                            │
├─────────────────────────────────────┤
│ Tento měsíc: 18 objednávek · 142 os.│
├─────────────────────────────────────┤
│ Po 27. 5.  ✓ Odesláno   8 os · 980 Kč│
│ Pá 23. 5.  ✓ Odesláno  12 os · 1 420│
│ …                                   │
└─────────────────────────────────────┘
```

### 3.2 Detail (read-only OrderData)

Same department grouping as Oběd, no edit actions. Optional PDF share (admin).

---

## 4. Profil

```
┌─────────────────────────────────────┐
│ Profil                              │
├─────────────────────────────────────┤
│  (avatar)  Jan Novák                │
│            jan@example.com          │
│            [user]                   │
├─────────────────────────────────────┤
│ Výchozí oddělení    Konstrukce   ▶  │
│ Připomínka push     20 min před  ▶  │
│ Přihlásit přes QR   Skenovat     ▶  │  ← also on login screen
├─────────────────────────────────────┤
│ Nastavení                        ▶  │
│ Nápověda                         ▶  │
├─────────────────────────────────────┤
│ [ Odhlásit se ]                     │
└─────────────────────────────────────┘
```

---

## 5. Nastavení (secondary)

```
┌─────────────────────────────────────┐
│ ◀ Nastavení                         │
├─────────────────────────────────────┤
│ Notifikace                          │
│   Push připomínka        [toggle]   │
│   E-mail potvrzení       [toggle]   │
├─────────────────────────────────────┤
│ Účet                                │
│   Změnit heslo                   ▶  │  credentials users only
│   Odhlásit všude                 ▶  │
├─────────────────────────────────────┤
│ Admin (role=admin only)             │
│   Správa uživatelů               ▶  │  future / web link
└─────────────────────────────────────┘
```

---

## 6. Auth flows

### 6.1 Login (cold start)

```
┌─────────────────────────────────────┐
│         Objednávky jídla            │
│                                     │
│  E-mail   [                       ] │
│  Heslo    [                       ] │
│                                     │
│  [ Přihlásit ]                      │
│                                     │
│  ─── nebo ───                       │
│  [ Pokračovat přes Google ]         │
│  [ Skenovat QR kód ]                │
│                                     │
│  Zapomenuté heslo?                  │
└─────────────────────────────────────┘
```

OAuth opens system browser (AppAuth / ASWebAuthenticationSession).

### 6.2 QR pairing scan

```
┌─────────────────────────────────────┐
│ ◀ Přihlášení přes QR                │
├─────────────────────────────────────┤
│                                     │
│     ┌─────────────────────┐         │
│     │   [camera viewfinder]│         │
│     │      ▢ QR frame      │         │
│     └─────────────────────┘         │
│                                     │
│ Naskenujte QR kód z webového profilu │
│                                     │
└─────────────────────────────────────┘
```

**Success**

```
┌─────────────────────────────────────┐
│            ✓ Přihlášeno             │
│         Vítejte, Jan Novák          │
│         (auto-navigate → Oběd)      │
└─────────────────────────────────────┘
```

**Error states**

| Code | Message |
|------|---------|
| expired | QR kód vypršel. Vygenerujte nový na webu. |
| used | QR kód už byl použit. |
| invalid | Neplatný QR kód. |
| offline | Přihlášení vyžaduje připojení k internetu. |

### 6.3 Web side (pairing QR generation)

On `/profil` (web, logged in):

```
┌─────────────────────────────────────┐
│ Přihlášení do mobilní aplikace      │
│                                     │
│     [QR code image]                 │
│     Platnost: 1:58                  │
│                                     │
│ [ Vygenerovat nový kód ]            │
└─────────────────────────────────────┘
```

QR payload: `kantyna://pair?v=1&token=<opaque>` (see API spec).

---

## 7. Offline & sync UX

```
┌─────────────────────────────────────┐
│ ⚠ Offline · naposledy sync 07:42    │  ← sticky banner
└─────────────────────────────────────┘
```

- Menu/history: serve from SQLite cache.
- Draft edits: saved locally immediately; outbox replays on reconnect.
- Pull-to-refresh triggers sync when online.
- Settings → “Sync now” for manual retry.

---

## 8. Push notification → deep link

| Payload | Opens |
|---------|-------|
| `{ "url": "/?date=2026-05-29" }` | Oběd tab, selected day |
| reminder title | Oběd tab, today |

---

## 9. Design tokens (mobile)

| Token | Value | Usage |
|-------|-------|-------|
| `color.primary` | `#EA580C` | CTA buttons, active tab, cutoff warning |
| `color.dept.*` | from `DEPT_COLORS` | department card accents |
| `radius.sheet` | platform default | bottom sheets |
| `spacing.base` | 16 | screen padding |

Platform components take precedence; brand color only on primary actions and highlights.

---

## 10. Screen checklist (v1 scope)

| Screen | v0 read-only | v1 full |
|--------|--------------|---------|
| Login + OAuth + QR | ✓ | ✓ |
| Oběd list | ✓ | ✓ |
| Edit row sheet | — | ✓ |
| Send (admin) | — | ✓ |
| Jídelníček | ✓ | ✓ |
| Historie list + detail | ✓ | ✓ |
| Profil + Nastavení | partial | ✓ |
| Push registration | — | ✓ |
| Offline outbox | — | ✓ |

Pizza ordering is **out of v1** (separate domain in backend).
