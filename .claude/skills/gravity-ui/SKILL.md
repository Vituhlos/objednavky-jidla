---
name: gravity-ui
description: Gravity UI (@gravity-ui/uikit) design systém pro migraci Kantýny. Použij při práci s Gravity komponentami, ThemeProvider, sandboxem /gravity-preview, nebo refaktoringem modalu/objednávkové stránky na UIKit.
---

# Gravity UI — Kantýna

## Kontext projektu

- Větev: **GravityUI**
- Stack: Next.js 16, React 19, TypeScript strict, SQLite
- Stávající UI: vlastní glass/Tailwind (`globals.css`, třídy `v2-*`)
- Cíl: postupná migrace na `@gravity-ui/uikit` bez rozbití business logiky

## Před implementací přečti

1. `docs/gravity-ui/README.md` — index AI zdrojů
2. `docs/gravity-ui/official/uikit-AGENTS.md` — **oficiální** UIKit pravidla
3. `docs/gravity-ui/official/navigation-agents.md` — navigace (AsideHeader, PageLayout)
4. `docs/GRAVITY-UI-MIGRATION.md` — fáze migrace
5. Sandbox: `app/gravity-preview/page.tsx`

UIKit nemá `llms.txt` — použij MCP `gravityui-docs` (`find`, `get`, `list`).

## Instalace (už v projektu)

```
@gravity-ui/uikit
@gravity-ui/icons
@bem-react/classname
```

## Integrace

```tsx
// Client wrapper
import { GravityRoot } from "@/components/gravity";

// Styly — jen v gravity route layoutu, ne globálně (zatím)
import "@gravity-ui/uikit/styles/fonts.css";
import "@gravity-ui/uikit/styles/styles.css";

// SSR
import { getRootClassName } from "@gravity-ui/uikit/server";
```

## Pravidla

- Importuj **pouze** z `@gravity-ui/uikit` a `@gravity-ui/icons`.
- **Nepřidávej** Gravity CSS do root layoutu, dokud není migrace schválena.
- Interaktivní komponenty = `"use client"`.
- České texty přes props, ne vestavěné EN/RU tokeny.
- Zachovej Server Actions, SSE, validaci — mění se jen UI vrstva.

## MCP (pokud nakonfigurováno)

Server `gravityui-docs` v `.cursor/mcp.json`:
- `find` — hledání komponent podle záměru
- `get` — props a příklady
- `list` — katalog podle kategorie/knihovny

## Priorita migrace

1. `DepartmentPanel.tsx` — modal objednávky
2. `OrderPage.tsx` — status bar, alerty
3. `AppTopBar.tsx` — navigace (později `@gravity-ui/navigation`)

## Ověření

```bash
npm run dev
# http://localhost:3000/gravity-preview
npm run build
```
