# Oficiální AI_AGENTS.md — @gravity-ui/aikit

Zdroj: https://github.com/gravity-ui/aikit/blob/main/docs/AI_AGENTS.md  
**Poznámka pro Kantýnu:** AIKit je pro AI chat UI — v tomto projektu zatím nepoužíváme. Soubor je zde pro referenci agentů.

---

# Using AIKit with AI Agents (Claude Code / Cursor)

When you install `@gravity-ui/aikit` in a downstream project, you can teach Claude Code and Cursor about it so they write correct code without you spelling out the API every time.

After install, two files are available locally:

- `node_modules/@gravity-ui/aikit/llms.txt` — concise index (component catalog + key links)
- `node_modules/@gravity-ui/aikit/llms-full.txt` — full documentation concatenated

V tomto repu bez instalace AIKit použij vendored kopii:

- `docs/gravity-ui/official/aikit-llms.txt`
- GitHub: https://raw.githubusercontent.com/gravity-ui/aikit/main/llms-full.txt

## Cursor: drop-in rule

Viz `.cursor/rules/aikit.mdc` v kořeni projektu.

## Claude Code: drop-in skill

Viz `.claude/skills/aikit/SKILL.md` v kořeni projektu.

## Verifying the setup

- **Cursor**: rule `aikit` se připojí při editaci `app/**/*.tsx` (pokud je AIKit v projektu).
- **Claude Code**: skill `aikit` v registru.
