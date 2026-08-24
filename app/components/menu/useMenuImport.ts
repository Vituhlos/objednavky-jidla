"use client";

import { useCallback, useState } from "react";
import { actionConfirmMenuImport } from "@/app/actions";
import type { ParseResult } from "@/lib/parse-menu";

export type MenuImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | {
      phase: "preview";
      result: ParseResult;
      targetWeekStart: string;
      targetLabel: string;
      tmpPdfName?: string;
    }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

type StartTransition = (callback: () => void | Promise<void>) => void;

interface UseMenuImportOptions {
  currentWeekStart: string;
  nextWeekStart: string;
  weekLabelOf: (weekStart: string) => string | null;
  startTransition: StartTransition;
  onImported: () => void;
}

function targetLabel(
  target: "aktuální týden" | "příští týden",
  weekStart: string,
  weekLabelOf: (weekStart: string) => string | null,
): string {
  const label = weekLabelOf(weekStart);
  return `${target}${label ? ` (${label})` : ""}`;
}

/**
 * Import jídelníčku z PDF — od výběru souboru po potvrzení náhledu.
 *
 * Cílový týden se hádá z toho, co parser vyčetl z hlavičky PDF. Pořadí testů
 * není libovolné: nerozpoznaný týden i týden shodný s aktuálním spadnou do
 * stejné větve, takže se import bez detekce nabídne do aktuálního týdne.
 *
 * Detekce se dá v náhledu přebít ručně (`selectCurrentWeek` / `selectNextWeek`),
 * protože hlavička PDF od LIMA občas nese týden, který neodpovídá tomu, kam
 * ho pořadatel chce nahrát.
 *
 * `startTransition` přichází zvenčí schválně — stránka má jediný `isPending`,
 * kterým blokuje akce, a vlastní transition uvnitř hooku by ho rozdvojil.
 */
export function useMenuImport({
  currentWeekStart,
  nextWeekStart,
  weekLabelOf,
  startTransition,
  onImported,
}: UseMenuImportOptions) {
  const [importState, setImportState] = useState<MenuImportState>({ phase: "idle" });

  const openImport = useCallback(() => setImportState({ phase: "uploading" }), []);
  const closeImport = useCallback(() => setImportState({ phase: "idle" }), []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setImportState({ phase: "error", message: "Soubor musí být PDF." });
      return;
    }

    setImportState({ phase: "uploading" });
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/menu/import", { method: "POST", body: formData });
      const result = await response.json() as ParseResult;
      if (!response.ok) {
        setImportState({
          phase: "error",
          message: (result as { error?: string }).error ?? "Neznámá chyba.",
        });
        return;
      }

      const detectedStart = result.weekStart;
      let targetWeekStart: string;
      let selectedTargetLabel: string;

      if (detectedStart === nextWeekStart) {
        targetWeekStart = nextWeekStart;
        selectedTargetLabel = targetLabel("příští týden", nextWeekStart, weekLabelOf);
      } else if (detectedStart && detectedStart !== currentWeekStart) {
        targetWeekStart = detectedStart;
        selectedTargetLabel = result.weekLabel ?? detectedStart;
      } else {
        targetWeekStart = currentWeekStart;
        selectedTargetLabel = targetLabel("aktuální týden", currentWeekStart, weekLabelOf);
      }

      setImportState({
        phase: "preview",
        result,
        targetWeekStart,
        targetLabel: selectedTargetLabel,
        tmpPdfName: result.tmpPdfName,
      });
    } catch {
      setImportState({ phase: "error", message: "Síťová chyba. Zkuste to znovu." });
    }
  }, [currentWeekStart, nextWeekStart, weekLabelOf]);

  const selectCurrentWeek = useCallback(() => {
    setImportState((previous) => previous.phase === "preview"
      ? {
          ...previous,
          targetWeekStart: currentWeekStart,
          targetLabel: targetLabel("aktuální týden", currentWeekStart, weekLabelOf),
        }
      : previous);
  }, [currentWeekStart, weekLabelOf]);

  const selectNextWeek = useCallback(() => {
    setImportState((previous) => previous.phase === "preview"
      ? {
          ...previous,
          targetWeekStart: nextWeekStart,
          targetLabel: targetLabel("příští týden", nextWeekStart, weekLabelOf),
        }
      : previous);
  }, [nextWeekStart, weekLabelOf]);

  const confirmImport = useCallback(() => {
    if (importState.phase !== "preview") return;
    const { result, targetWeekStart, tmpPdfName } = importState;
    setImportState({ phase: "saving" });
    startTransition(async () => {
      const label = result.weekLabel ?? targetWeekStart;
      await actionConfirmMenuImport(targetWeekStart, label, result.items, tmpPdfName);
      setImportState({ phase: "done" });
      onImported();
    });
  }, [importState, onImported, startTransition]);

  return {
    importState,
    isImportOpen: importState.phase !== "idle" && importState.phase !== "done",
    openImport,
    closeImport,
    retryImport: openImport,
    handleFile,
    selectCurrentWeek,
    selectNextWeek,
    confirmImport,
  };
}
