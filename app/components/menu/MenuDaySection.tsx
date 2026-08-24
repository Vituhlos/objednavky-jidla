"use client";

import { getHolidayEmoji } from "@/lib/holidays";
import type { MenuItem } from "@/lib/types";
import MIcon from "../MIcon";
import { MenuSection } from "./MenuSection";
import { DAY_LABELS, describeDay } from "./menu-utils";

interface MenuDaySectionProps {
  day: string;
  soups: MenuItem[];
  meals: MenuItem[];
  holidayName: string | null;
  closure: { label: string; icon: string } | null;
  editMode: boolean;
  disabled: boolean;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
  onEdit: (item: MenuItem) => void;
  onCloseDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}

/**
 * Obsah jednoho dne — mobilní zobrazení.
 *
 * Zavřený den má tři různé důvody a každý mluví jinak: státní svátek, ručně
 * zadaná uzavírka (dovolená), nebo prostě zástupná položka „Zavřeno" z PDF.
 * Rozlišují se proto, že jen u toho třetího dává smysl nabídnout „Otevřít den" —
 * uzavírku se mění v Nastavení a svátek se nemění vůbec.
 *
 * Proti větvi feat/heroui-migration tu chybí `date` a `isToday`: tam nadpis
 * oddílu nese spouštěč accordionu, tady si datum drží přepínač dnů nad obsahem.
 */
export function MenuDaySection({
  day,
  soups,
  meals,
  holidayName,
  closure,
  editMode,
  disabled,
  onAdd,
  onEdit,
  onCloseDay,
  onOpenDay,
}: MenuDaySectionProps) {
  const dayView = describeDay({ soups, meals });
  const closureLabel = closure?.label ?? null;
  const holidayEmoji = getHolidayEmoji(holidayName);

  return (
    <div className="space-y-3">
      <div className="font-display font-bold text-[17px] text-stone-900 mb-1 pt-2">{DAY_LABELS[day]}</div>
      {dayView.isClosed ? (
        <div className="glass-card rounded-3xl overflow-hidden">
          <div
            className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40"
            style={{ background: holidayName || !closureLabel ? "rgba(245,158,11,0.08)" : "rgba(148,163,184,0.10)" }}
          >
            <div
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
              style={{ background: holidayName || !closureLabel ? "rgba(245,158,11,0.14)" : "rgba(148,163,184,0.16)" }}
            >
              {holidayName ? (
                <span className="emoji text-[18px] leading-none">{holidayEmoji}</span>
              ) : closureLabel ? (
                <span className="emoji text-[18px] leading-none">{closure!.icon}</span>
              ) : (
                <MIcon
                  name="event_busy"
                  size={18}
                  fill
                  style={{ color: "#D97706" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display font-bold text-[13.5px] text-stone-900 leading-none">
                {holidayName ?? closureLabel ?? "Zavřeno"}
              </div>
              <div className="text-[11.5px] text-stone-500 mt-0.5">
                {holidayName
                  ? "Svátek / zavřeno"
                  : closureLabel
                    ? "Zavřeno — v tento den se nevaří"
                    : "V tento den není jídelníček k dispozici."}
              </div>
            </div>
          </div>
          <div className="px-4 py-4 flex flex-col items-center gap-3">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium text-stone-600"
              style={{ background: "rgba(255,255,255,0.58)", border: "1px solid rgba(245,158,11,0.14)" }}
            >
              <MIcon name="info" size={14} style={{ color: "#D97706" }} />
              <span>
                {holidayName
                  ? "V tento den se jídla nevydávají."
                  : closureLabel
                    ? (editMode ? "Zavřeno je nastavené v Nastavení → Zavřeno / dovolená." : "V tento den se v LIMA nevaří.")
                    : "Zkuste jiný den nebo doplnit menu v editaci."}
              </span>
            </div>
            {editMode && !closureLabel && (
              <button
                className="text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
                disabled={disabled}
                onClick={() => onOpenDay(day)}
                type="button"
              >
                Otevřít den
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <MenuSection
            accent="rgba(245,158,11,0.12)"
            disabled={disabled}
            editMode={editMode}
            emptyLabel="Žádné polévky pro tento den."
            icon="restaurant"
            iconColor="#D97706"
            items={dayView.soups}
            onAdd={() => onAdd(day, "Polévka")}
            onEdit={onEdit}
            title="Polévky"
          />
          <MenuSection
            accent="rgba(234,88,12,0.1)"
            disabled={disabled}
            editMode={editMode}
            emptyLabel="Žádná jídla pro tento den."
            icon="restaurant_menu"
            iconColor="#EA580C"
            items={dayView.meals}
            onAdd={() => onAdd(day, "Jídlo")}
            onEdit={onEdit}
            title="Jídla"
          />
          {editMode && (
            <button
              className="w-full text-[12px] font-semibold py-2 rounded-2xl glass-btn-danger text-red-600"
              disabled={disabled}
              onClick={() => onCloseDay(day)}
              type="button"
            >
              Uzavřít den
            </button>
          )}
        </>
      )}
    </div>
  );
}
