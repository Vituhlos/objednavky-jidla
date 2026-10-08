"use client";

import { useLayoutEffect, useRef } from "react";
import { DEFAULT_CLOSURE_ICON } from "@/lib/closure-icons";
import { formatGapLabel, getDayLabel, type PickerItem } from "./order-utils";

/**
 * Vodorovný pás dnů, mezi kterými se dá přepínat.
 *
 * Zavřené dny se do pásu nedávají po jednom — slepí se do jedné „mezery“
 * („zavřeno 5.–9. 8.“). Deset stejných nefunkčních čipů by pás natáhlo a
 * neřeklo nic navíc.
 *
 * Mezera má tři podoby podle toho, co zrovna znamená: když je v ní vybraný
 * den, je to nekliknutelný ukazatel pozice (`aria-current`, **ne** `disabled` —
 * to by čtečce tvrdilo „nedostupné“, což je opak); když v ní leží dnešek,
 * je z ní tlačítko zpátky na dnešek; jinak je to jen tichý popisek.
 *
 * Vybraný den značí pilulka, která mezi dny klouže. Přesune se hned po volbě
 * (`pendingDate`), nečeká na odpověď serveru — jinak klepnutí působilo opožděně.
 *
 * Pilulka je potomek vybraného čipu, ne samostatný prvek pod čipy. První verze
 * ji měla zvlášť a spoléhala na `z-index`; Safari na iOS ale vrstvy s transformací
 * řadí po svém, takže pilulka jednou zakryla popisek a jindy se nevykreslila.
 * Takhle je výběr správně i bez animace a klouzání je jen přechod navíc.
 */
export function DayPicker({
  pickerItems,
  selectedDate,
  pendingDate,
  todayDate,
  onSelect,
}: {
  pickerItems: PickerItem[];
  selectedDate?: string;
  /** Den, na který se právě přechází (klepnutím i přejetím prstem). */
  pendingDate?: string | null;
  todayDate?: string;
  onSelect: (date: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /** Kde pilulka stála naposledy (v souřadnicích pásu) — odtud vyjíždí animace. */
  const lastSpot = useRef<{ left: number; width: number } | null>(null);
  const shownDate = pendingDate ?? selectedDate;

  useLayoutEffect(() => {
    const track = trackRef.current;
    const scroller = scrollerRef.current;
    const chip = track && shownDate ? track.querySelector<HTMLElement>(`[data-date="${shownDate}"]`) : null;
    if (!chip) {
      lastSpot.current = null;
      return;
    }
    const spot = { left: chip.offsetLeft, width: chip.offsetWidth };
    const previous = lastSpot.current;
    lastSpot.current = spot;

    // Vybraný den doroluj do zorného pole (pás je širší než displej).
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      const target = spot.left - (scroller.clientWidth - spot.width) / 2;
      scroller.scrollTo({ left: Math.max(0, target), behavior: previous ? "smooth" : "auto" });
    }

    // Klouzání: pilulka už stojí na novém místě (je součástí čipu), jen se
    // na okamžik opticky vrátí na staré a dojede. Když animace neproběhne,
    // výběr je stejně vidět správně.
    const pill = chip.querySelector<HTMLElement>(".day-pill");
    if (!pill || !previous || spot.width === 0 || (previous.left === spot.left && previous.width === spot.width)) return;
    if (typeof pill.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pill.animate(
      [
        { transform: `translateX(${previous.left - spot.left}px) scaleX(${previous.width / spot.width})` },
        { transform: "none" },
      ],
      { duration: 340, easing: "cubic-bezier(.22,1.15,.36,1)" },
    );
  }, [shownDate, pickerItems]);

  return (
    <div className="relative -mx-4">
      <div className="overflow-x-auto no-scrollbar px-4" ref={scrollerRef}>
        <div
          className="flex p-1 rounded-2xl gap-0.5"
          ref={trackRef}
          style={{ width: "max-content", background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.55)" }}
        >
          {pickerItems.map((item) => {
            if (item.kind === "gap") {
              const label = `zavřeno ${formatGapLabel(item.from, item.to)}`;
              // The gap swallowed today's chip, so it inherits its two jobs:
              // showing where you are, and getting you back. Amber fill rather
              // than the orange gradient — this IS the current position, but
              // the gradient means "actionable day" everywhere else in the strip.
              const isActive = !!selectedDate && selectedDate >= item.from && selectedDate <= item.to;
              const holdsToday = !!todayDate && todayDate >= item.from && todayDate <= item.to;
              // Same emoji the menu screen puts on its week tabs — a closure
              // should be recognisable at a glance from either screen. Manual
              // one-off closed days carry no icon of their own, so they borrow
              // the closure default rather than switching to a Material glyph:
              // one slot, one drawing voice.
              const mark = (
                <span className="emoji text-[13px] leading-none">
                  {item.icon ?? DEFAULT_CLOSURE_ICON}
                </span>
              );

              // Deliberately NOT a disabled button when active. `disabled`
              // announces "unavailable" and drops the element out of the tab
              // order — but this marker means "you are here", which is the
              // opposite claim. Non-interactive markup states position; the
              // button exists only when there is somewhere to go.
              if (isActive) {
                return (
                  <span
                    aria-current="date"
                    className="flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center gap-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap select-none"
                    key={`gap-${item.from}`}
                    style={{ background: "rgba(245,158,11,0.16)", color: "#92400e" }}
                    title="V tyto dny se v LIMĚ nevaří"
                  >
                    {mark}
                    {label}
                  </span>
                );
              }

              if (holdsToday) {
                return (
                  <button
                    className="flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center gap-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap text-stone-600 transition-all duration-200 hover:text-stone-800 hover:bg-white/60 active:scale-[0.96]"
                    key={`gap-${item.from}`}
                    onClick={() => onSelect(todayDate!)}
                    title="Zpět na dnešek – v tyto dny se nevaří"
                    type="button"
                  >
                    {mark}
                    {label}
                  </button>
                );
              }

              return (
                <span
                  className="flex-shrink-0 self-center px-3 inline-flex items-center gap-1.5 text-[11.5px] text-stone-500 whitespace-nowrap select-none"
                  key={`gap-${item.from}`}
                  title="V tyto dny se v LIMĚ nevaří"
                >
                  {mark}
                  {label}
                </span>
              );
            }
            // Day chips are orderable days only — closed ones live in the gaps.
            const date = item.date;
            const isActive = date === selectedDate;
            const isShown = date === shownDate;
            return (
              <button
                aria-current={isActive ? "date" : undefined}
                data-date={date}
                key={date}
                className={`relative isolate flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center rounded-xl text-[12.5px] font-semibold transition-colors duration-200 active:scale-[0.96] ${
                  isShown ? "text-white" : "text-stone-600 hover:text-stone-800"
                }`}
                onClick={() => { if (isShown) return; onSelect(date); }}
                type="button"
              >
                {isShown && <span aria-hidden="true" className="day-pill" />}
                {getDayLabel(date, todayDate!)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none" aria-hidden
        style={{ background: "linear-gradient(to right, transparent, var(--bg))" }} />
    </div>
  );
}
