"use client";

import type { MenuWeek } from "@/app/jidelnicek/page";
import MIcon from "../MIcon";

interface MenuHeaderProps {
  /** Úpravy jídelníčku umí jen správce. */
  canManage?: boolean;
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
  canManage = true,
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
          {canManage && (
          <button
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={onToggleEdit}
            type="button"
          >
            {editMode ? "Zavřít úpravu" : "Upravit ručně"}
          </button>
          )}
          {canManage && canDeleteActiveWeek && (
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn-danger active:scale-[0.97] transition disabled:opacity-50"
              disabled={isPending}
              onClick={onRequestDeleteWeek}
              type="button"
            >
              Smazat {activeWeekName}
            </button>
          )}
          {canManage && (
          <button
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
            onClick={onOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={14} /> Import PDF
          </button>
          )}
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Jídelníček LIMA</span>
          {activeWeekLabel && <span className="text-[11px] text-stone-500">{activeWeekLabel}</span>}
          {canManage && (
          <button
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600"
            onClick={onOpenImport}
            type="button"
          >
            <MIcon name="upload_file" size={13} /> PDF
          </button>
          )}
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex p-1 rounded-2xl gap-0.5 shrink-0" style={{ background: "rgba(26,18,8,0.07)", border: "1px solid rgba(255,255,255,0.55)" }}>
          {weeks.map((week) => {
            const active = week.weekStart === activeWeekStart;
            return (
              <button
                key={week.weekStart}
                /* Same metrics as the day picker on the order page: one visual language, and
                     44px is the touch-target minimum this strip was under. */
                  className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] flex items-center rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.97] whitespace-nowrap ${active ? "" : "text-stone-500 hover:text-stone-700 hover:bg-white/60"}`}
                onClick={() => onSelectWeek(week.weekStart)}
                style={active ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", color: "white", boxShadow: "0 2px 8px -2px rgba(234,88,12,0.35)" } : {}}
                type="button"
              >
                {/* A fully closed week says so in the tab — no need to click to find out */}
                {week.weekClosure && <span className="emoji mr-1">{week.weekClosure.icon}</span>}
                {week.tabLabel}
              </button>
            );
          })}
        </div>
        {hasPdfActive && (
          <a className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-stone-600 md:hidden"
            download href={`/api/menu/pdf/${activeWeekStart}`}>
            ↓ PDF
          </a>
        )}
        {canManage && isCurrentWeek && (
          <button
            className={`md:hidden inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn ${editMode ? "text-stone-900" : "text-stone-600"}`}
            onClick={onToggleEdit}
            type="button"
          >
            {editMode ? "Zavřít" : "Upravit"}
          </button>
        )}
      </div>
    </>
  );
}
