"use client";

import { useCallback, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { DepartmentData, OrderRowEnriched } from "@/lib/types";
import { actionDeleteRow } from "@/app/actions";
import { recalcDepartments } from "./order-utils";

export type PendingDelete = { rowId: number; rowData: OrderRowEnriched; deptName: string };

const UNDO_WINDOW_MS = 5000;

/**
 * Mazání řádku s možností vrácení.
 *
 * Řádek z UI zmizí hned a smazání na serveru se odloží o pět vteřin — po tu
 * dobu jde kliknout na „Zpět". Odložené smazání se proto musí **dotáhnout**
 * pokaždé, když se od něj odchází: při přepnutí dne, při odchodu ze stránky
 * i když se během čekání maže další řádek. Jinak by řádek zmizel z obrazovky,
 * ale v databázi zůstal.
 */
export function useRowDeletion({
  departmentsRef,
  setDepartments,
}: {
  departmentsRef: RefObject<DepartmentData[]>;
  setDepartments: Dispatch<SetStateAction<DepartmentData[]>>;
}) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitDelete = useCallback((rowId: number) => {
    actionDeleteRow(rowId).catch(() => {});
    setPendingDelete(null);
    pendingDeleteRef.current = null;
    pendingDeleteTimer.current = null;
  }, []);

  /** Dotáhne odložené smazání bez čekání. Volá se při odchodu z kontextu. */
  const flushPendingDelete = useCallback(() => {
    if (!pendingDeleteTimer.current) return;
    clearTimeout(pendingDeleteTimer.current);
    pendingDeleteTimer.current = null;
    if (pendingDeleteRef.current) {
      actionDeleteRow(pendingDeleteRef.current.rowId).catch(() => {});
      pendingDeleteRef.current = null;
    }
  }, []);

  const handleDeleteRow = useCallback((rowId: number) => {
    if (pendingDeleteTimer.current && pendingDeleteRef.current) {
      clearTimeout(pendingDeleteTimer.current);
      commitDelete(pendingDeleteRef.current.rowId);
    }

    // Find and capture row data before removing from UI
    const dept = departmentsRef.current.find((d) => d.rows.some((r) => r.id === rowId));
    const rowData = dept?.rows.find((r) => r.id === rowId);

    // Optimistic remove
    setDepartments((prev) =>
      recalcDepartments(prev.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== rowId) })))
    );

    if (!rowData || !dept) {
      actionDeleteRow(rowId).catch(() => {});
      return;
    }

    const info: PendingDelete = { rowId, rowData, deptName: dept.name };
    pendingDeleteRef.current = info;
    setPendingDelete(info);
    pendingDeleteTimer.current = setTimeout(() => commitDelete(rowId), UNDO_WINDOW_MS);
  }, [commitDelete, departmentsRef, setDepartments]);

  const handleUndoDelete = useCallback(() => {
    if (!pendingDeleteTimer.current || !pendingDeleteRef.current) return;
    clearTimeout(pendingDeleteTimer.current);
    pendingDeleteTimer.current = null;
    const { deptName, rowData } = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    setDepartments((prev) =>
      recalcDepartments(
        prev.map((d) => d.name === deptName ? { ...d, rows: [...d.rows, rowData] } : d)
      )
    );
    setPendingDelete(null);
  }, [setDepartments]);

  /** Zahodí odložené smazání i jeho oznámení — po dotažení nebo při resetu. */
  const clearPendingDelete = useCallback(() => setPendingDelete(null), []);

  return { pendingDelete, handleDeleteRow, handleUndoDelete, flushPendingDelete, clearPendingDelete };
}
