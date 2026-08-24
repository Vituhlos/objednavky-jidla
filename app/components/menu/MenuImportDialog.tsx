"use client";

import { useRef, useState } from "react";
import MIcon from "../MIcon";
import { PreviewTable } from "./PreviewTable";
import type { MenuImportState } from "./useMenuImport";

interface MenuImportDialogProps {
  isOpen: boolean;
  state: MenuImportState;
  currentWeekStart: string;
  nextWeekStart: string;
  isPending: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  onRetry: () => void;
  onSelectCurrentWeek: () => void;
  onSelectNextWeek: () => void;
  onConfirm: () => void;
}

/**
 * Import jídelníčku z PDF.
 *
 * Fáze jsou stavy jednoho dialogu, ne samostatná okna — uživatel neztrácí
 * kontext mezi nahráním a potvrzením. Náhled desítek položek si bere širší
 * sheet než samotný výběr souboru.
 *
 * Stav přetahování a odkaz na skrytý `input[type=file]` patří sem, ne
 * koordinátorovi: mimo tenhle dialog nemají co dělat.
 */
export function MenuImportDialog({
  isOpen,
  state,
  currentWeekStart,
  nextWeekStart,
  isPending,
  onClose,
  onFile,
  onRetry,
  onSelectCurrentWeek,
  onSelectNextWeek,
  onConfirm,
}: MenuImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-sheet${state.phase === "preview" ? " !w-full sm:!w-[760px]" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="import-modal-title">
            {state.phase === "preview" ? "Náhled importu" : "Importovat PDF jídelníčku"}
          </h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 font-bold"
            onClick={onClose}
            type="button"
          >
            <MIcon name="close" size={16} />
          </button>
        </div>
        <div className="modal-sheet__body">
          {state.phase === "uploading" && (
            <>
              <div
                className={`flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition ${isDragging ? "border-amber-400 bg-amber-50/50" : "border-white/50 glass-soft"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
              >
                <MIcon name="upload_file" size={32} style={{ color: "#D97706" }} />
                <p className="text-[13px] text-stone-600 text-center">Přetáhněte PDF sem nebo klikněte pro výběr</p>
                <input accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
              </div>
              <p className="text-[12px] text-stone-400 text-center">Čekám na soubor...</p>
            </>
          )}
          {state.phase === "error" && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700">
              <strong>Chyba:</strong> {state.message}
              <button className="ml-3 text-[12px] font-semibold text-red-600 underline" onClick={onRetry} type="button">Zkusit znovu</button>
            </div>
          )}
          {state.phase === "preview" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px] text-stone-600">
                  Rozpoznáno <strong>{state.result.items.length}</strong> položek
                  {state.result.weekLabel && <>, týden <strong>{state.result.weekLabel}</strong></>}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-400">Uložit jako:</span>
                  <button
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${state.targetWeekStart === currentWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                    onClick={onSelectCurrentWeek}
                    style={state.targetWeekStart === currentWeekStart ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
                    type="button"
                  >
                    Aktuální
                  </button>
                  <button
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${state.targetWeekStart === nextWeekStart ? "text-white" : "glass-btn text-stone-600"}`}
                    onClick={onSelectNextWeek}
                    style={state.targetWeekStart === nextWeekStart ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
                    type="button"
                  >
                    Příští
                  </button>
                </div>
              </div>
              <PreviewTable items={state.result.items} />
            </>
          )}
          {state.phase === "saving" && (
            <p className="text-[13px] text-stone-500 text-center py-4">Ukládám jídelníček...</p>
          )}
        </div>
        {state.phase === "preview" && (
          <div className="modal-sheet__footer">
            <button className="modal-btn modal-btn--secondary" onClick={onClose} type="button">Zrušit</button>
            <button className="modal-btn modal-btn--primary" disabled={isPending} onClick={onConfirm} type="button">
              {isPending ? "Ukládám..." : "Uložit jídelníček"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
