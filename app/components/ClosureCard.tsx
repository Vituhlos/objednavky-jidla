import type { ClosureContext } from "@/lib/menu";

// The one visual for "LIMA nevaří" — shared by the menu screen (whole week swallowed
// by a closure) and the order screen (the selected day falls inside one). A closure
// is the same fact on both pages, so it gets the same card; only the surrounding
// scroll container differs.
//
// Amber, not grey: grey reads as "chybí data". A shutdown isn't missing information,
// it's a planned, known state — same amber family as the cutoff bar and the heads-up
// banner that announces the closure before it starts.

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
      <div className="flex flex-col items-center text-center px-6 py-8 gap-3">
        <div
          className="w-16 h-16 rounded-2xl inline-flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.14)" }}
        >
          <span className="emoji text-[32px] leading-none">{closure.icon}</span>
        </div>
        <div>
          <div className="font-display font-bold text-[20px] text-stone-900 leading-tight">
            {closure.label}
          </div>
          <div className="text-[13px] text-stone-500 mt-1 tabular-nums">
            Od {shortDate(closure.startDate)} do {shortDate(closure.endDate)} se v LIMA nevaří
          </div>
        </div>
        {closure.note && (
          <p className="text-[13px] text-stone-500 leading-relaxed max-w-sm">{closure.note}</p>
        )}
      </div>
      {hasBounds && (
        <div
          className="flex flex-wrap justify-center gap-x-10 gap-y-3 px-6 py-4"
          style={{ borderTop: "1px solid rgba(245,158,11,0.18)", background: "rgba(245,158,11,0.05)" }}
        >
          {closure.lastOrderable && (
            <div className="text-center">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400 leading-none">
                Poslední oběd
              </div>
              <div className="text-[14px] font-semibold text-stone-800 mt-1 tabular-nums">
                {dayPhrase(closure.lastOrderable)}
              </div>
            </div>
          )}
          {closure.reopens && (
            <div className="text-center">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400 leading-none">
                Vaří se zase od
              </div>
              <div className="text-[14px] font-semibold text-stone-800 mt-1 tabular-nums">
                {dayPhrase(closure.reopens)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
