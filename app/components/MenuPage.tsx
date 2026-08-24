"use client";

import { useState, useRef, useTransition, useCallback, useEffect, useMemo } from "react";
import type { MenuItem } from "@/lib/types";
import {
  actionDeleteMenuWeek,
  actionAddMenuItem,
  actionUpdateMenuItem,
  actionDeleteMenuItem,
  actionCloseDay,
  actionOpenDay,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import type { MenuWeek } from "@/app/jidelnicek/page";
import { MenuDeleteDialogs } from "./menu/MenuDeleteDialogs";
import { MenuHeader } from "./menu/MenuHeader";
import { MenuImportDialog } from "./menu/MenuImportDialog";
import { MenuItemEditModal } from "./menu/MenuItemEditModal";
import { MenuWorkspace } from "./menu/MenuWorkspace";
import { describeWeekName, resolveActiveDay, type WeekMenu } from "./menu/menu-utils";
import { useMenuDeletion } from "./menu/useMenuDeletion";
import { useMenuImport } from "./menu/useMenuImport";

interface Props {
  weeks: MenuWeek[];
  todayCode: string | null;
  defaultMealPrice: number;
  defaultSoupPrice: number;
}

/**
 * Rozepsaná nová položka, která ještě není v databázi.
 *
 * Dřív „Přidat" položku rovnou zapsalo a teprve pak otevřelo dialog. Zavření
 * bez vyplnění tak v jídelníčku nechalo řádek „bez názvu", který se navíc
 * počítal do souhrnu dne — a přes SSE se rozeslal ostatním. Záporné id
 * odlišuje koncept od skutečného řádku; skutečná `id` z SQLite jsou kladná.
 */
const DRAFT_ITEM_ID = -1;

/**
 * Koordinátor jídelníčku. Drží výběr týdne a dne, optimistické úpravy položek
 * a skládá domény dohromady: záhlaví, pracovní plochu, import PDF a mazání.
 *
 * Všechny domény sdílejí jediný `useTransition`. Díky tomu má stránka jeden
 * `isPending`, kterým se blokují akce — import ho dostává parametrem, aby si
 * nezaložil vlastní a nerozdvojil tak stav „něco běží“.
 */
export default function MenuPage({
  weeks,
  todayCode,
  defaultMealPrice,
  defaultSoupPrice,
}: Props) {
  const currentWeekStart = weeks.find((w) => w.isCurrent)?.weekStart ?? weeks[0].weekStart;
  const [activeWeekStart, setActiveWeekStart] = useState(currentWeekStart);
  // Optimistic per-week overrides of the server menu, keyed by weekStart.
  // Replaces the old pair of currentMenu/nextMenu states.
  const [menuEdits, setMenuEdits] = useState<Record<string, WeekMenu>>({});
  const prevWeeksRef = useRef(weeks);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [activeDayOverride, setActiveDayOverride] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const activeWeekData = weeks.find((w) => w.weekStart === activeWeekStart) ?? weeks[0];
  const nextWeekStart = weeks.find((w) => !w.isCurrent)?.weekStart ?? currentWeekStart;
  const activeMenu = menuEdits[activeWeekStart] ?? activeWeekData.menu;
  const visibleTodayCode = activeWeekData.isCurrent ? todayCode : null;
  // Any non-current week holding a menu can be deleted (was: only "next week")
  const canDeleteActiveWeek = !activeWeekData.isCurrent && Object.keys(activeWeekData.menu).length > 0;
  const activeWeekName = describeWeekName(activeWeekData.tabLabel);
  const weekLabelOf = useCallback(
    (weekStart: string) => weeks.find((w) => w.weekStart === weekStart)?.weekLabel ?? null,
    [weeks]
  );

  useEffect(() => {
    if (prevWeeksRef.current !== weeks) {
      prevWeeksRef.current = weeks;
      setMenuEdits({});
    }
  }, [weeks]);

  const activeDay = useMemo(
    () => activeDayOverride && activeMenu[activeDayOverride]
      ? activeDayOverride
      : resolveActiveDay(activeMenu, visibleTodayCode),
    [activeDayOverride, activeMenu, visibleTodayCode]
  );

  // ── Optimistické úpravy položek ───────────────────────────────────────────

  // Úpravy se zapisují vždy do přepisu pro *aktivní* týden; jako výchozí stav
  // se bere serverové menu, dokud pro ten týden žádný přepis neexistuje.
  const setActiveWeekMenu = useCallback(
    (fn: (prev: WeekMenu) => WeekMenu) =>
      setMenuEdits((edits) => ({ ...edits, [activeWeekStart]: fn(edits[activeWeekStart] ?? activeWeekData.menu) })),
    [activeWeekStart, activeWeekData]
  );

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number; allergens: string }>) => {
    setActiveWeekMenu((prev) => {
      const next = { ...prev };
      for (const day of Object.keys(next)) {
        next[day] = {
          soups: next[day].soups.map((s) => s.id === id ? { ...s, ...updates } : s),
          meals: next[day].meals.map((m) => m.id === id ? { ...m, ...updates } : m),
        };
      }
      return next;
    });
    startTransition(async () => { await actionUpdateMenuItem(id, updates); });
  }, [setActiveWeekMenu]);

  const handleDelete = useCallback((id: number) => {
    startTransition(async () => {
      await actionDeleteMenuItem(id);
      setActiveWeekMenu((prev) => {
        const next = { ...prev };
        for (const day of Object.keys(next)) {
          next[day] = {
            soups: next[day].soups.filter((s) => s.id !== id),
            meals: next[day].meals.filter((m) => m.id !== id),
          };
        }
        return next;
      });
    });
  }, [setActiveWeekMenu]);

  /**
   * „Přidat" jen otevře dialog s konceptem. Do databáze se nezapisuje nic,
   * dokud uživatel neuloží — proto po zavření dialogu nemá co zůstat.
   */
  const handleAdd = useCallback((day: string, type: "Polévka" | "Jídlo") => {
    setEditingItem({
      id: DRAFT_ITEM_ID,
      weekLabel: activeWeekData.weekLabel,
      day,
      type,
      code: type === "Polévka" ? "A" : "1",
      name: "",
      price: type === "Polévka" ? defaultSoupPrice : defaultMealPrice,
      allergens: "",
    });
  }, [activeWeekData, defaultSoupPrice, defaultMealPrice]);

  /**
   * Uložení z dialogu. Koncept se teprve zakládá, existující položka se
   * aktualizuje — dialog o tom rozdílu vědět nemusí, řeší ho koordinátor.
   */
  const handleSaveItem = useCallback((id: number, updates: Partial<{ code: string; name: string; allergens: string }>) => {
    if (id !== DRAFT_ITEM_ID) {
      handleUpdate(id, updates);
      return;
    }
    const draft = editingItem;
    if (!draft) return;

    startTransition(async () => {
      const created = await actionAddMenuItem({
        day: draft.day,
        type: draft.type,
        code: updates.code ?? draft.code,
        name: updates.name ?? "",
        price: draft.price,
        weekStart: activeWeekStart,
      });
      // `actionAddMenuItem` alergeny nepřijímá, doplní se hned poté. Druhý
      // zápis se dělá jen když nějaké alergeny opravdu jsou.
      const allergens = updates.allergens ?? "";
      const item = allergens ? await actionUpdateMenuItem(created.id, { allergens }) : created;

      setActiveWeekMenu((prev) => {
        const dayData = prev[draft.day] ?? { soups: [], meals: [] };
        return {
          ...prev,
          [draft.day]: {
            soups: draft.type === "Polévka" ? [...dayData.soups, item] : dayData.soups,
            meals: draft.type === "Jídlo" ? [...dayData.meals, item] : dayData.meals,
          },
        };
      });
    });
  }, [activeWeekStart, editingItem, handleUpdate, setActiveWeekMenu]);

  // ── Domény ────────────────────────────────────────────────────────────────

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleCloseDay = useCallback((day: string) => {
    startTransition(async () => { await actionCloseDay(day, activeWeekStart); refresh(); });
  }, [activeWeekStart, refresh]);

  const handleOpenDay = useCallback((day: string) => {
    startTransition(async () => { await actionOpenDay(day, activeWeekStart); refresh(); });
  }, [activeWeekStart, refresh]);

  const handleDeleteWeek = useCallback(() => {
    startTransition(async () => {
      await actionDeleteMenuWeek(activeWeekStart);
      refresh();
    });
  }, [activeWeekStart, refresh]);

  const deletion = useMenuDeletion({ onDeleteItem: handleDelete, onDeleteWeek: handleDeleteWeek });

  const menuImport = useMenuImport({
    currentWeekStart,
    nextWeekStart,
    weekLabelOf,
    startTransition,
    onImported: refresh,
  });

  const { closeImport, openImport } = menuImport;
  const { cancelDeleteWeek } = deletion;

  const handleWeekSwitch = useCallback((weekStart: string) => {
    setActiveWeekStart(weekStart);
    setActiveDayOverride(null);
    setEditMode(false);
    cancelDeleteWeek();
  }, [cancelDeleteWeek]);

  // Úpravy a import se navzájem vylučují — otevření jednoho zavírá druhý.
  const handleToggleEdit = useCallback(() => {
    setEditMode((v) => !v);
    closeImport();
  }, [closeImport]);

  const handleOpenImport = useCallback(() => {
    setEditMode(false);
    openImport();
  }, [openImport]);

  return (
    <div className="k-shell">
      <MenuHeader
        activeWeekLabel={activeWeekData.weekLabel}
        activeWeekName={activeWeekName}
        activeWeekStart={activeWeekStart}
        canDeleteActiveWeek={canDeleteActiveWeek}
        editMode={editMode}
        hasPdfActive={activeWeekData.hasPdf}
        isCurrentWeek={activeWeekData.isCurrent}
        isPending={isPending}
        onOpenImport={handleOpenImport}
        onRequestDeleteWeek={deletion.requestDeleteWeek}
        onSelectWeek={handleWeekSwitch}
        onToggleEdit={handleToggleEdit}
        weeks={weeks}
      />

      <MenuWorkspace
        activeDay={activeDay}
        activeMenu={activeMenu}
        activeWeekData={activeWeekData}
        activeWeekStart={activeWeekStart}
        editMode={editMode}
        isPending={isPending}
        onAdd={handleAdd}
        onCloseDay={handleCloseDay}
        onEdit={setEditingItem}
        onOpenDay={handleOpenDay}
        onSelectDay={setActiveDayOverride}
        visibleTodayCode={visibleTodayCode}
      />

      {editingItem !== null && (
        <MenuItemEditModal
          disabled={isPending}
          isNew={editingItem.id === DRAFT_ITEM_ID}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onRequestDelete={(id) => { setEditingItem(null); deletion.requestDeleteItem(id); }}
          onSave={handleSaveItem}
        />
      )}

      <MenuDeleteDialogs
        isPending={isPending}
        isWeekConfirmOpen={deletion.isWeekConfirmOpen}
        onCancelItem={deletion.cancelDeleteItem}
        onCancelWeek={deletion.cancelDeleteWeek}
        onConfirmItem={deletion.confirmDeleteItem}
        onConfirmWeek={deletion.confirmDeleteWeek}
        pendingItemId={deletion.pendingItemId}
        weekName={activeWeekName}
      />

      <MenuImportDialog
        currentWeekStart={currentWeekStart}
        isOpen={menuImport.isImportOpen}
        isPending={isPending}
        nextWeekStart={nextWeekStart}
        onClose={closeImport}
        onConfirm={menuImport.confirmImport}
        onFile={menuImport.handleFile}
        onRetry={menuImport.retryImport}
        onSelectCurrentWeek={menuImport.selectCurrentWeek}
        onSelectNextWeek={menuImport.selectNextWeek}
        state={menuImport.importState}
      />
    </div>
  );
}
