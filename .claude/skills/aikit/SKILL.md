---
name: aikit
description: Gravity UI AIKit (@gravity-ui/aikit) pro AI chat UI. Použij jen když uživatel explicitně pracuje s AI chatem — Kantýna primárně migruje na UIKit.
---

# @gravity-ui/aikit (volitelné)

## Dokumentace v repu

- `docs/gravity-ui/official/aikit-llms.txt` — katalog (vždy dostupný)
- `docs/gravity-ui/official/aikit-AI_AGENTS.md` — oficiální Cursor/Claude integrace
- Po instalaci: `node_modules/@gravity-ui/aikit/llms-full.txt`

## Klíčové konvence

- `ChatContainer` = nejrychlejší integrace; jinak `PromptInput` + `MessageList` + `Header`.
- Custom content: `createMessageRendererRegistry` + `registerMessageRenderer<T>(reg, 'type', {render: …})` → `messageRendererRegistry` na `MessageList`.
- Theme: `@gravity-ui/aikit/themes/common` + `/light` nebo `/dark` + `<ThemeProvider>` z UIKit.
- Subpath importy pro tree-shaking.
- Peer deps: @gravity-ui/uikit, @gravity-ui/icons, @gravity-ui/i18n, @diplodoc/transform, highlight.js, react>=18.

## Ověření

```bash
# po instalaci AIKit
cat node_modules/@gravity-ui/aikit/llms.txt | head
```
