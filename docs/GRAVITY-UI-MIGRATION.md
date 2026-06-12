# Přechod na Gravity UI (větev GravityUI)

Průvodce pro postupnou migraci Kantýny z vlastního glass/Tailwind designu na [Gravity UI](https://gravity-ui.com/).

## Cíl

- Zachovat veškerou business logiku (SQLite, Server Actions, SSE, scheduler).
- Postupně nahradit UI vrstvu komponentami z `@gravity-ui/uikit`.
- Nezlomit produkční vzhled během experimentů — izolovaný sandbox + route groups.

## Nainstalované balíčky

```bash
npm install @gravity-ui/uikit @gravity-ui/icons @bem-react/classname
```

| Balíček | Účel |
|---------|------|
| `@gravity-ui/uikit` | Základní komponenty (Button, Select, Modal, Table…) |
| `@gravity-ui/icons` | Ikony sladěné s UIKit |
| `@bem-react/classname` | Peer dependency UIKit |

Volitelné pro pozdější fáze: `@gravity-ui/navigation`, `@gravity-ui/date-components`.

## Architektura v tomto repu

```
app/
  gravity-preview/          # Izolovaný sandbox — Gravity styly jen zde
    layout.tsx              # ThemeProvider + import CSS
    page.tsx                # Ukázkové komponenty

components/gravity/
  GravityRoot.tsx           # Client wrapper (ThemeProvider, configure)
  index.ts

docs/
  GRAVITY-UI-MIGRATION.md   # Tento soubor

.cursor/
  rules/gravity-ui.mdc      # Pravidla pro Cursor agenta
  mcp.json                  # MCP dokumentace Gravity UI

.claude/skills/gravity-ui/
  SKILL.md                  # Skill pro Claude/Cursor

tools/gravityui-reference-mcp/   # Lokální MCP server (git clone)
```

## Strategie migrace (doporučená)

### Fáze 0 — Příprava (hotovo / právě děláme)

1. Balíčky nainstalované.
2. Sandbox `/gravity-preview` pro vizuální srovnání.
3. MCP + Cursor rule + skill pro agenty.

### Fáze 1 — Společný shell

1. Obalit **jen vybrané route groups** do `GravityRoot`, ne celou app hned.
2. Mapování stávajících tříd → Gravity komponenty:

| Dnes (Kantýna) | Gravity UI |
|----------------|------------|
| `v2-btn --primary` | `<Button view="action" size="l">` |
| `v2-btn --secondary` | `<Button view="outlined">` |
| `v2-btn --danger` | `<Button view="outlined-danger">` |
| `modal-sheet` | `<Modal>` / `<Dialog>` |
| `MenuSelect` (custom) | `<Select>` |
| `v2-topbar` / `AppTopBar` | později `@gravity-ui/navigation` |
| `glass` karty | `<Card>` / `<Container>` |

### Fáze 2 — Objednávková stránka

Priorita podle dopadu:

1. `DepartmentPanel.tsx` — modal objednávky (Select, Button, TextInput, TextArea).
2. `OrderPage.tsx` — status bar, alerty, tlačítko Odeslat.
3. `AppTopBar.tsx` — navigace.

### Fáze 3 — Zbytek

Historie, jídelníček, nastavení, pizza.

## Integrace do Next.js App Router

### SSR bez flash tématu

V layoutu route group použij `getRootClassName` z `@gravity-ui/uikit/server`:

```tsx
import {getRootClassName} from '@gravity-ui/uikit/server';

const rootClassName = getRootClassName({theme: 'light'});
// přidej rootClassName na <html> nebo wrapper
```

### Client komponenty

UIKit komponenty s interakcí = `"use client"`. Server Actions a data fetching zůstávají v RSC.

### Styly — nekolidovat s Tailwind

**Nedávej** `@gravity-ui/uikit/styles/*.css` do root `layout.tsx`, dokud nemigruješ celou app.

Pro experimenty používej `app/gravity-preview/layout.tsx` (jen tato route).

### i18n

UIKit má vestavěné tokeny `en` / `ru`. Pro češtinu:

```ts
import {configure} from '@gravity-ui/uikit';
configure({lang: 'en'}); // vlastní texty v aplikaci zůstávají česky
```

Vlastní labely předávej přes props (`label`, `placeholder`, `children`) — ne spoléhej na vestavěné EN/RU stringy.

## Odkazy

- [Gravity UI — homepage](https://gravity-ui.com/)
- [UIKit Storybook](https://preview.gravity-ui.com/uikit/)
- [UIKit AGENTS.md](https://github.com/gravity-ui/uikit/blob/main/AGENTS.md)
- [Next.js příklad](https://github.com/gravity-ui/gravity-ui-nextjs-example)
- [MCP gravityui-reference-mcp](https://github.com/antonskiter/gravityui-reference-mcp)

## Oficiální AI podpora

Viz **`docs/gravity-ui/README.md`** — kompletní index.

| Zdroj | Soubor / konfigurace |
|-------|----------------------|
| UIKit AGENTS.md | `docs/gravity-ui/official/uikit-AGENTS.md` |
| Navigation agents.md | `docs/gravity-ui/official/navigation-agents.md` |
| AIKit AI_AGENTS.md | `docs/gravity-ui/official/aikit-AI_AGENTS.md` |
| AIKit llms.txt | `docs/gravity-ui/official/aikit-llms.txt` |
| Cursor rule UIKit | `.cursor/rules/gravity-ui.mdc` |
| Cursor rule AIKit | `.cursor/rules/aikit.mdc` |
| MCP gravityui-docs | `.cursor/mcp.json` |

UIKit **nemá** vlastní `llms.txt` — API komponent řeš přes MCP nebo [Storybook](https://preview.gravity-ui.com/uikit/).

Sync oficiálních souborů: `.\scripts\sync-gravity-official-docs.ps1`

## MCP v Cursoru

Po `.\scripts\setup-gravity-ui.ps1` (klonuje MCP do `tools/gravityui-reference-mcp`):

1. Zkopíruj `.cursor/mcp.json.example` → `.cursor/mcp.json` a nastav **absolutní cestu** k repu (soubor je gitignored).
2. Restartuj Cursor → Settings → MCP — server `gravityui-docs`.
3. V Agent módu: „Jaký Gravity UI Select použít pro výběr jídla s placeholderem?“

Nástroje: `find`, `get`, `list` — offline katalog 1300+ entit ([gravityui-reference-mcp](https://github.com/antonskiter/gravityui-reference-mcp)).

## Ověření

```bash
npm run dev
# http://localhost:3000/gravity-preview
```

Build musí projít i když hlavní app ještě používá starý design.
