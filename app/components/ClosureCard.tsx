import type { ClosureContext } from "@/lib/menu";

// The one visual for "LIMA nevaří" — shared by the menu screen (whole week swallowed
// by a closure) and the order screen (the selected day falls inside one). A closure
// is the same fact on both pages, so it gets the same card; only the surrounding
// scroll container differs.
//
// Amber, not grey: grey reads as "chybí data". A shutdown isn't missing information,
// it's a planned, known state — same amber family as the cutoff bar and the heads-up
// banner that announces the closure before it starts.
//
// Left-biased, not centred. The centred-icon-tile-over-centred-heading shape is the
// most generic card layout there is; reading it costs a scan down the middle and back.
// Ranged left, the eye lands on the emoji, runs along the label, and drops straight
// onto the two dates in the footer — one column, one direction.

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}.`;
}

// "pátek 31. 7." — weekday spelled out, because that's how people check whether
// they still have time to order.
function dayPhrase(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString("cs-CZ", { weekday: "long" });
  return `${weekday} ${d}. ${m}.`;
}

function Bound({ label, iso }: { label: string; iso: string }) {
  return (
    <div>
      {/* stone-500, not stone-400: at 11px the lighter grey measured 2.59:1 against
          the card, well under the 4.5:1 floor — and these two dates are the whole
          reason the footer exists. */}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 leading-none">
        {label}
      </div>
      <div className="text-[14px] font-semibold text-stone-800 mt-1.5 tabular-nums">
        {dayPhrase(iso)}
      </div>
    </div>
  );
}

export default function ClosureCard({ closure }: { closure: ClosureContext }) {
  const hasBounds = !!(closure.lastOrderable || closure.reopens);

  return (
    <div
      /* w-full is load-bearing: as a flex item (the order page wraps its content in
         a flex column) `mx-auto` overrides stretch and collapses the card to its
         content width, which crams the two footer columns together and makes the
         header/footer read as two separate cards. Explicit width keeps it 512px in
         both a block parent (menu page) and a flex one. */
      className="glass-card rounded-3xl w-full mx-auto max-w-lg overflow-hidden"
      style={{ borderColor: "rgba(245,158,11,0.28)" }}
    >
      <div className="flex items-start gap-4 px-6 py-7">
        {/* No tinted tile behind it. The emoji is the operator's own choice and reads
            as an object at display size; boxing it turns it into a stock icon-chip. */}
        <span className="emoji text-[38px] leading-none shrink-0 mt-0.5">{closure.icon}</span>
        <div className="min-w-0">
          {/* The only heading on either screen while a closure is showing — without it
              a screen reader gets a page with no landmark explaining why it's empty. */}
          <h1 className="font-display font-bold text-[20px] text-stone-900 leading-tight">
            {closure.label}
          </h1>
          <div className="text-[13px] text-stone-500 mt-1 tabular-nums">
            Od {shortDate(closure.startDate)} do {shortDate(closure.endDate)} se v LIMA nevaří
          </div>
          {closure.note && (
            <p className="text-[13px] text-stone-500 leading-relaxed mt-2.5">{closure.note}</p>
          )}
        </div>
      </div>
      {hasBounds && (
        <div
          /* Tighter gutter on narrow screens: at 320px the two columns plus a 48px
             gap leave 3px of slack, so one longer weekday name would wrap them. */
          className="flex flex-wrap gap-x-8 sm:gap-x-12 gap-y-3 px-6 py-4"
          style={{ borderTop: "1px solid rgba(245,158,11,0.18)", background: "rgba(245,158,11,0.05)" }}
        >
          {closure.lastOrderable && <Bound label="Poslední oběd" iso={closure.lastOrderable} />}
          {closure.reopens && <Bound label="Vaří se zase od" iso={closure.reopens} />}
        </div>
      )}
    </div>
  );
}
