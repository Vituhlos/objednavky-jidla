"use client";

import { ConfirmModal } from "../ConfirmModal";

interface MenuDeleteDialogsProps {
  pendingItemId: number | null;
  isWeekConfirmOpen: boolean;
  weekName: string;
  isPending: boolean;
  onCancelItem: () => void;
  onConfirmItem: () => void;
  onCancelWeek: () => void;
  onConfirmWeek: () => void;
}

/** Obě potvrzení mazání. Stav drží `useMenuDeletion`, tady je jen jejich podoba. */
export function MenuDeleteDialogs({
  pendingItemId,
  isWeekConfirmOpen,
  weekName,
  isPending,
  onCancelItem,
  onConfirmItem,
  onCancelWeek,
  onConfirmWeek,
}: MenuDeleteDialogsProps) {
  return (
    <>
      {pendingItemId !== null && (
        <ConfirmModal
          message="Tato položka jídelníčku bude trvale odstraněna."
          onClose={onCancelItem}
          onConfirm={onConfirmItem}
          title="Smazat položku"
        />
      )}
      {isWeekConfirmOpen && (
        <ConfirmModal
          confirmLabel="Smazat"
          isPending={isPending}
          message={`Celý jídelníček (${weekName}) bude trvale odstraněn.`}
          onClose={onCancelWeek}
          onConfirm={onConfirmWeek}
          title={`Smazat ${weekName}`}
        />
      )}
    </>
  );
}
