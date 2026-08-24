"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import MIcon from "../MIcon";
import { ALLERGEN_NAMES, formatAllergens, parseAllergens } from "./AllergenBadges";
import { AutoResizeTextarea } from "./AutoResizeTextarea";

/**
 * Úprava jedné položky jídelníčku.
 *
 * Komponenta se montuje až ve chvíli, kdy je co upravovat — rozepsaná pole
 * tak vzniknou čerstvá pro každou položku a nemusí se resetovat efektem.
 *
 * `isNew` odlišuje rozepsaný koncept od skutečného řádku v databázi. Koncept
 * nemá co mazat a nedá se uložit bez názvu — právě bezejmenný řádek byl to,
 * co dřív po zavření dialogu zůstávalo v jídelníčku viset.
 */
export function MenuItemEditModal({ item, isNew, disabled, onSave, onRequestDelete, onClose }: {
  item: MenuItem;
  /** Rozepsaná nová položka, která ještě není v databázi. */
  isNew: boolean;
  disabled: boolean;
  onSave: (id: number, updates: Partial<{ code: string; name: string; allergens: string }>) => void;
  onRequestDelete: (id: number) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [activeAllergens, setActiveAllergens] = useState<Set<number>>(
    () => new Set(parseAllergens(item.allergens))
  );

  const toggleAllergen = (n: number) => {
    setActiveAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const handleSave = () => {
    onSave(item.id, { code, name, allergens: formatAllergens(activeAllergens) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet !w-full sm:!w-[420px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="item-edit-modal-title">
            {isNew ? "Přidat" : "Upravit"} {item.type === "Polévka" ? "polévku" : "jídlo"}
          </h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500"
            onClick={onClose}
            type="button"
          >
            <MIcon name="close" size={16} />
          </button>
        </div>
        <div className="modal-sheet__body space-y-4">
          <div>
            <label className="modal-label">Kód</label>
            <input
              className="modal-input w-20 mt-1"
              disabled={disabled}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="modal-label">Název</label>
            <div className="mt-1">
              <AutoResizeTextarea
                disabled={disabled}
                onChange={setName}
                placeholder="Název jídla"
                value={name}
              />
            </div>
          </div>
          <div>
            <label className="modal-label">Alergeny</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => {
                const active = activeAllergens.has(n);
                return (
                  <button
                    key={n}
                    disabled={disabled}
                    onClick={() => toggleAllergen(n)}
                    title={ALLERGEN_NAMES[n]}
                    aria-label={`Alergen ${n}: ${ALLERGEN_NAMES[n]}`}
                    type="button"
                    className="w-11 h-11 rounded-lg text-[13px] font-bold transition active:scale-95"
                    style={active
                      ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)", color: "white", boxShadow: "0 2px 6px -1px rgba(234,88,12,0.30)" }
                      : { background: "rgba(26,18,8,0.06)", border: "1px solid rgba(255,255,255,0.6)", color: "#78716c" }
                    }
                  >{n}</button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-sheet__footer">
          {!isNew && (
            <button
              className="modal-btn modal-btn--danger"
              disabled={disabled}
              onClick={() => { onRequestDelete(item.id); onClose(); }}
              type="button"
            >
              Smazat
            </button>
          )}
          <button
            className="modal-btn modal-btn--primary"
            disabled={disabled || (isNew && name.trim() === "")}
            onClick={handleSave}
            type="button"
          >
            {isNew ? "Přidat" : "Uložit"}
          </button>
        </div>
      </div>
    </div>
  );
}
