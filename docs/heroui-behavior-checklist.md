# HeroUI migration behavior checklist

Use this checklist before changing a page and again after its migration. Visual
differences are expected; functional differences are regressions unless explicitly
approved.

## Global shell and PWA

- [ ] All enabled navigation destinations remain reachable.
- [ ] `/pizza` visibility still follows `pizzaEnabled`.
- [ ] Current page indication works on desktop and mobile.
- [ ] Long meal and department names do not overflow the layout.
- [ ] Keyboard focus is visible and navigation is usable without a mouse.
- [ ] Dialogs and drawers trap and restore focus correctly.
- [ ] Mobile bottom controls respect iOS safe areas and do not cover content.
- [ ] Loading, empty, disabled, success, warning, and error states remain clear.

## History (`/historie`)

- [ ] Draft and sent lunch orders are listed with the same totals and status.
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
