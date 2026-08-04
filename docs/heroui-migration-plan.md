# HeroUI v3 migration plan

This document is the tracked source of truth for rebuilding the Kantyna frontend
with HeroUI v3 while preserving existing product behavior.

## Goal

- Preserve routes, data flows, server actions, SSE synchronization, calculations,
  validation, permissions, scheduling, PDF/e-mail behavior, and PWA behavior.
- Replace the current visual layer with stock HeroUI v3 components and its default
  theme.
- Reach behavioral parity before introducing any custom visual identity.

## Fixed decisions

1. Pin `@heroui/react` and `@heroui/styles` to `3.2.3`.
2. Use HeroUI v3 compound APIs and `onPress` where supported. Never use v2 APIs.
3. Do not port the current amber/stone palette, glassmorphism, gradients, orbs,
   shadows, or custom animations.
4. HeroUI semantic states such as `danger`, `warning`, and `success` are allowed
   because they communicate behavior. Raw Tailwind color utilities are not.
5. Department color values stay in SQLite for compatibility, but the first
   migrated UI does not render them. Reintroducing them is a later product choice.
6. Tailwind is used for layout only: grid, flex, spacing, sizing, positioning, and
   responsive behavior.
7. Legacy CSS remains available to pages that have not been migrated. It is
   removed incrementally and `globals.css` is minimized only after the last page
   reaches parity.
8. Czech date, time, number, and React Aria behavior use locale `cs-CZ`.
9. Telegram, scheduler, database, server-action, and Zod refactors are not blockers
   for the UI migration unless a migrated component directly requires a change.
10. Each page migration is a separate commit and must pass `npm run build` plus
    the relevant checks in `docs/heroui-behavior-checklist.md`.

## Documentation order

Before implementing a HeroUI component, verify its API in this order:

1. `.heroui-docs/react/` generated for this project.
2. Installed TypeScript declarations for version `3.2.3`.
3. HeroUI MCP component documentation.

The MCP server can expose stale version labels, so its version metadata alone is
not authoritative.

## Migration sequence

### 0. Tooling checkpoint (complete)

- HeroUI skill, MCP, and `agents-md` documentation installed.
- HeroUI packages pinned to `3.2.3`.
- Production build verified.

### 1. Runtime foundation

- Import `@heroui/styles` after `tailwindcss`.
- Add the smallest possible client-side `I18nProvider` for `cs-CZ`.
- Keep the current application shell and legacy CSS working.
- Confirm the production build without changing page behavior.

### 2. Baseline and pilot

- Record the current flows using the behavior checklist.
- Migrate `/historie` and its detail pages first because they are read-only.
- Establish reusable neutral layout patterns without creating a custom design
  system.

### 3. Page-by-page migration

1. `/nastaveni`
2. `/jidelnicek`
3. `/pizza`
4. `/` ordering flow and `DepartmentPanel`

For every page:

- Read the existing component as the behavioral specification.
- Extract pure helpers only when necessary for the page being migrated.
- Replace UI primitives with documented HeroUI components.
- Test desktop, mobile, keyboard navigation, validation, loading, empty, error,
  and disabled states.
- Remove only the legacy styles that no remaining page uses.

### 4. Cleanup

- Remove dead legacy components and CSS.
- Verify PWA safe areas and iOS standalone behavior.
- Run the complete behavior checklist.
- Only then consider custom theme tokens or department accents.

## Non-goals during migration

- No database schema changes.
- No rewrite of business rules or server actions for aesthetic reasons.
- No new navigation features, workflow redesign, or content changes.
- No custom theme, branded palette, gradients, or decorative motion.
- No release tag or production deployment as part of migration commits.

## Definition of done

- Users can complete every existing workflow with the same results and rules.
- HeroUI v3 supplies interactive primitives and accessibility behavior.
- No migrated component depends on the old visual classes.
- Unmigrated pages remain usable throughout the incremental migration.
- Production build passes and the behavior checklist is signed off.
