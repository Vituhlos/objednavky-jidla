# HeroUI migration behavior checklist

Use this checklist before changing a page and again after its migration. Visual
differences are expected; functional differences are regressions unless explicitly
approved.

## Global shell and PWA

> Baseline recorded on 2026-08-04: `/` already reports a hydration mismatch in
> `OrderPage` around the responsive push-notification/header controls on unchanged
> `main`. Treat it as a pre-existing issue and ensure migration work does not add
> new console errors.

- [ ] All enabled navigation destinations remain reachable.
- [ ] `/pizza` visibility still follows `pizzaEnabled`.
- [ ] Current page indication works on desktop and mobile.
- [ ] Long meal and department names do not overflow the layout.
- [ ] Keyboard focus is visible and navigation is usable without a mouse.
- [ ] Dialogs and drawers trap and restore focus correctly.
- [ ] Mobile bottom controls respect iOS safe areas and do not cover content.
- [ ] Loading, empty, disabled, success, warning, and error states remain clear.

## History (`/historie`)

- [x] Draft and sent lunch orders are listed with the same totals and status.
- [x] Empty drafts are hidden by default and the HeroUI switch restores them.
- [x] Search still matches the formatted date and lunch extra e-mail.
- [x] Empty data and zero search results remain distinct; filtered results can be
      reset directly from the empty state.
- [x] Lunch and pizza rows preserve their original detail destinations.
- [x] `pizzaEnabled` still controls whether the pizza history section is rendered.
- [x] Narrow viewports keep date, status, and the open action visible without
      covering the mobile navigation.
- [ ] Lunch order detail shows all departments, rows, notes, and prices.
- [ ] Pizza history and pizza detail remain reachable and accurate.
- [ ] Existing PDF/detail actions still work.
- [ ] Deleted departments remain visible in historical orders.

## Settings (`/nastaveni`)

- [ ] Incorrect PIN is rejected and the correct PIN unlocks settings.
- [ ] SMTP settings, recipients, deadlines, prices, IMAP, auto-send, Telegram,
      push, and backup sections retain their current values and validation.
- [ ] Test actions expose pending, success, and failure states.
- [ ] Departments can be added, renamed, reordered, disabled, and deleted under
      the same business rules.
- [ ] Closure date ranges and time fields save values with Czech locale semantics.
- [ ] Backup export and additive restore still work.

## Menu (`/jidelnicek`)

- [ ] Current and next week remain selectable.
- [ ] PDF import preview preserves parsed days, meals, soups, prices, and allergens.
- [ ] Import confirmation writes the same menu data.
- [ ] Menu items can be added, edited, and deleted.
- [ ] A day can be closed and reopened with the same validation.
- [ ] Holiday and closure states remain visible without relying on the old palette.

## Pizza (`/pizza`)

- [ ] Pizza rows can be added, edited, and deleted.
- [ ] Pizza selection, quantity, extras, notes, and prices calculate identically.
- [ ] Automatic price-list refresh retains its pending, success, and error behavior.
- [ ] Disabled pizza ordering remains inaccessible from navigation and page flows.

## Lunch ordering (`/`)

- [ ] Day selection and closure rules show the same available days.
- [ ] Rows can be added, edited, and deleted in every active department.
- [ ] Soup, meal, side, extra meal, quantity, and note values persist correctly.
- [ ] Price calculations and order summaries are unchanged.
- [ ] Cutoff countdown and locked/unlocked behavior follow the same Prague time.
- [ ] Optimistic updates reconcile with the server result.
- [ ] SSE changes from a second client refresh the order without a page reload.
- [ ] Sending remains atomic and prevents duplicate sends.
- [ ] SMTP failure returns the order to draft and shows an actionable error.
- [ ] Re-send, reopen, clear, and manual unlock actions keep their current rules.
- [ ] Generated e-mail and per-department PDF output are unchanged.

## Verification record

For each migrated page record:

- Commit:
- Desktop browser/result:
- Mobile/PWA result:
- Keyboard result:
- Known intentional differences:

### `3c71256 feat: migrate history list to HeroUI`

- Desktop browser/result: Chromium 1695×920; lunch records, hide-empty switch,
  date/e-mail search, filtered-zero reset, row navigation and responsive columns
  passed. The list uses only stock HeroUI surfaces, cards, tables, fields, switch,
  chips, typography, empty state and button components.
- Mobile/PWA result: Chromium 390×844; compact header, core table columns,
  scrolling and bottom-navigation clearance passed.
- Keyboard result: switch and search are reachable by Tab; the HeroUI table
  receives focus and `ArrowDown` + `Enter` opened `/historie/637`.
- Known intentional differences: the migrated page uses the neutral HeroUI theme,
  semantic success/default status chips and a constrained centered content column.
  The shared application navigation remains legacy until its own migration step.
- Console: clean after fixing the shared sidebar clock's server/client timestamp
  mismatch. The separate pre-existing push-control mismatch on `/` remains.
