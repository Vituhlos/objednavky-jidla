"use client";

import type { MenuWeek } from "@/app/jidelnicek/page";
import MIcon from "../MIcon";
import { useSlidingPill } from "../useSlidingPill";

interface MenuHeaderProps {
  weeks: MenuWeek[];
  activeWeekStart: string;
  activeWeekLabel: string | null;
  hasPdfActive: boolean;
  isCurrentWeek: boolean;
  editMode: boolean;
  canDeleteActiveWeek: boolean;
  activeWeekName: string;
  isPending: boolean;
  onSelectWeek: (weekStart: string) => void;
  onToggleEdit: () => void;
  onOpenImport: () => void;
  onRequestDeleteWeek: () => void;
}

/**
 * Záhlaví stránky: název, popis vybraného týdne, akce a přepínač týdnů.
 *
 * Desktop a mobil mají každý vlastní lištu, protože se liší nabídkou akcí —
 * na mobilu se mazání týdne nevejde a úprava se ukazuje jen u aktuálního týdne.
 *
 * Proti větvi feat/heroui-migration je tohle rozdvojení navíc: tam je jedna
 * responzivní lišta a `onSelectWeek` neexistuje, protože přepínač týdnů drží
 * kontext `Tabs` u koordinátoru.
 */
export function MenuHeader({
  weeks,
  activeWeekStart,
  activeWeekLabel,
  hasPdfActive,
  isCurrentWeek,
  editMode,
  canDeleteActiveWeek,
  activeWeekName,
  isPending,
  onSelectWeek,
  onToggleEdit,
  onOpenImport,
  onRequestDeleteWeek,
}: MenuHeaderProps) {
  // Výběr týdne klouže stejně jako výběr dne na stránce objednávek.
  const weekTrackRef = useSlidingPill<HTMLDivElement>(activeWeekStart, { watch: weeks });
  return (
    <>
      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900">Jídelníček LIMA</span>
        {activeWeekLabel && (
          <span className="text-[12px] text-stone-500">Týden <strong className="text-stone-700">{activeWeekLabel}</strong></span>
        )}
        {hasPdfActive && (
          <a className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
            download href={`/api/menu/pdf/${activeWeekStart}`}>
            ↓ PDF
          </a>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={onToggleEdit}
            type="button"
          >
            {editMode ? "Zavřít úpravu" : "Upravit ručně"}
          </button>
          {canDeleteActiveWeek && (
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger active:scale-[0.97] transition disabled:opacity-50"
              disabled={isPending}
              onClick={onRequestDeleteWeek}
              type="button"
            >
              Smazat {activeWeekName}
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
            onClick={onOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={14} /> Import PDF
          </button>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <h1 className="font-display font-bold text-[18px] leading-tight text-stone-900 flex-1 min-w-0 truncate">Jídelníček LIMA</h1>
          {/* Akce patří k nadpisu; dřív se „Upravit" a stažení PDF mačkaly vedle přepínače týdnů. */}
          {hasPdfActive && (
            <a
              aria-label="Stáhnout PDF jídelníčku"
              className="tap inline-flex items-center justify-center w-10 rounded-xl glass-btn text-stone-600 shrink-0"
              download
              href={`/api/menu/pdf/${activeWeekStart}`}
            >
              <MIcon name="download" size={16} />
            </a>
          )}
          {isCurrentWeek && (
            <button
              className={`tap inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn shrink-0 ${editMode ? "text-stone-900" : "text-stone-600"}`}
              onClick={onToggleEdit}
              type="button"
            >
              {editMode ? "Hotovo" : "Upravit"}
            </button>
          )}
          <button
            className="tap inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-stone-600 shrink-0"
            onClick={onOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={14} /> Import
          </button>
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex p-1 rounded-2xl gap-0.5 shrink-0" ref={weekTrackRef} style={{ background: "rgba(26,18,8,0.07)", border: "1px solid rgba(255,255,255,0.55)" }}>
          {weeks.map((week) => {
            const active = week.weekStart === activeWeekStart;
            return (
              <button
                key={week.weekStart}
                /* Same metrics as the day picker on the order page: one visual language, and
                     44px is the touch-target minimum this strip was under. */
                  className={`relative isolate flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center rounded-xl text-[12.5px] font-semibold transition-colors duration-200 active:scale-[0.97] whitespace-nowrap ${active ? "text-white" : "text-stone-500 hover:text-stone-700"}`}
                data-pill-key={week.weekStart}
                onClick={() => onSelectWeek(week.weekStart)}
                type="button"
              >
                {active && <span aria-hidden="true" className="day-pill" data-pill />}
                {/* A fully closed week says so in the tab — no need to click to find out */}
                {week.weekClosure && <span className="emoji mr-1">{week.weekClosure.icon}</span>}
                {week.tabLabel}
              </button>
            );
          })}
        </div>
        {activeWeekLabel && (
          <span className="md:hidden ml-auto self-center shrink-0 text-[12px] text-stone-500">{activeWeekLabel}</span>
        )}
      </div>
    </>
  );
}
