"use client";

import { useCallback, useState } from "react";

interface UseMenuDeletionOptions {
  onDeleteItem: (id: number) => void;
  onDeleteWeek: () => void;
}

/**
 * Potvrzování mazání v jídelníčku — jedna položka a celý týden.
 *
 * Obě potvrzení drží jen svůj vlastní stav; samotné mazání zůstává u
 * koordinátoru, protože sahá na optimistické úpravy menu a na server actions.
 *
 * Pořadí kroků je záměrně různé a kopíruje původní kód:
 * u položky se nejdřív spustí mazání a teprve pak se zavře dialog, u týdne
 * naopak. `handleDeleteNextWeek` totiž dialog zavíral ještě před `startTransition`.
 */
export function useMenuDeletion({ onDeleteItem, onDeleteWeek }: UseMenuDeletionOptions) {
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [isWeekConfirmOpen, setIsWeekConfirmOpen] = useState(false);

  const requestDeleteItem = useCallback((id: number) => setPendingItemId(id), []);
  const cancelDeleteItem = useCallback(() => setPendingItemId(null), []);

  const confirmDeleteItem = useCallback(() => {
    if (pendingItemId === null) return;
    onDeleteItem(pendingItemId);
    setPendingItemId(null);
  }, [onDeleteItem, pendingItemId]);

  const requestDeleteWeek = useCallback(() => setIsWeekConfirmOpen(true), []);
  const cancelDeleteWeek = useCallback(() => setIsWeekConfirmOpen(false), []);

  const confirmDeleteWeek = useCallback(() => {
    setIsWeekConfirmOpen(false);
    onDeleteWeek();
  }, [onDeleteWeek]);

  return {
    pendingItemId,
    isWeekConfirmOpen,
    requestDeleteItem,
    cancelDeleteItem,
    confirmDeleteItem,
    requestDeleteWeek,
    cancelDeleteWeek,
    confirmDeleteWeek,
  };
}
