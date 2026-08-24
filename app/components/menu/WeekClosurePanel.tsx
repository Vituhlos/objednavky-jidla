"use client";

import type { WeekClosure } from "@/app/jidelnicek/page";
import ClosureCard from "../ClosureCard";

// ── Whole-week closure (replaces the day grid) ────────────────────────────────

// Five identical "Zavřeno" cards say one thing five times. A closure covers a SPAN,
// so when it swallows the whole week the page states it once. The card itself lives
// in ClosureCard — the order screen shows the same one for a closed day.
export function WeekClosurePanel({ closure }: { closure: WeekClosure }) {
  return (
    <div className="flex-1 overflow-y-auto scroll-area px-4 pb-nav md:pb-8 pt-3">
      <ClosureCard closure={closure} />
    </div>
  );
}
