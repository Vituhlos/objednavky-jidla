# Gravity UI — AI podpora v projektu

Oficiální a doplněné zdroje pro agenty (Cursor, Claude) při migraci Kantýny.

## Oficiální dokumenty (vendored)

| Soubor | Zdroj na GitHubu |
|--------|------------------|
| `official/uikit-AGENTS.md` | [gravity-ui/uikit/AGENTS.md](https://github.com/gravity-ui/uikit/blob/main/AGENTS.md) |
| `official/navigation-agents.md` | [gravity-ui/navigation/agents.md](https://github.com/gravity-ui/navigation/blob/main/agents.md) |
| `official/aikit-AI_AGENTS.md` | [gravity-ui/aikit/docs/AI_AGENTS.md](https://github.com/gravity-ui/aikit/blob/main/docs/AI_AGENTS.md) |
| `official/aikit-llms.txt` | [gravity-ui/aikit/llms.txt](https://github.com/gravity-ui/aikit/blob/main/llms.txt) |

**UIKit nemá `llms.txt`** — pro UIKit komponenty používej MCP server `gravityui-docs` (nástroje `find`, `get`, `list`).

Aktualizace: `.\scripts\sync-gravity-official-docs.ps1`

## Cursor rules

| Rule | Kdy |
|------|-----|
| `.cursor/rules/gravity-ui.mdc` | UIKit migrace — **hlavní** pro Kantýnu |
| `.cursor/rules/aikit.mdc` | Jen při práci s `@gravity-ui/aikit` (AI chat) |

## Skills

| Skill | Cesta |
|-------|-------|
| `gravity-ui` | `.claude/skills/gravity-ui/SKILL.md` |
| `aikit` | `.claude/skills/aikit/SKILL.md` |

## MCP — gravityui-reference-mcp

Neoficiální, ale nejúplnější offline katalog (34 knihoven, 1351 entit).

- Konfigurace: `.cursor/mcp.json` → server `gravityui-docs`
- Lokální klon: `tools/gravityui-reference-mcp/` (gitignored, vytvoří `setup-gravity-ui.ps1`)
- Repo: https://github.com/antonskiter/gravityui-reference-mcp

Po změně cesty v `mcp.json` **restartuj Cursor**.

## llms.txt — shrnutí

| Balíček | llms.txt |
|---------|----------|
| `@gravity-ui/uikit` | ❌ neexistuje → MCP nebo Storybook |
| `@gravity-ui/aikit` | ✅ `node_modules/.../llms.txt` nebo `docs/gravity-ui/official/aikit-llms.txt` |

## Migrace aplikace

Viz `docs/GRAVITY-UI-MIGRATION.md` a sandbox `/gravity-preview`.
