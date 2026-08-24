"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MealEntry, MenuItem, OrderRowEnriched } from "@/lib/types";
import type { ExtrasPrices } from "@/lib/pricing";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";
import { MenuSelect } from "./MenuSelect";
import { ModalStepper } from "./ModalStepper";
import type { RowUpdates } from "./types";
import { useMounted } from "./use-media";

export function OrderEditModal({
  row, soups, meals, isNew, defaultSoupPrice, defaultMealPrice, ep, existingNames, onSave, onClose, onDelete,
}: {
  row: OrderRowEnriched; soups: import("@/lib/types").MenuItem[]; meals: import("@/lib/types").MenuItem[];
  isNew: boolean; defaultSoupPrice?: number; defaultMealPrice?: number; ep: ExtrasPrices;
  existingNames: string[];
  onSave: (u: RowUpdates) => void; onClose: () => void; onDelete: () => void;
}) {
  const [firstName, setFirstName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/)[0] ?? "";
    try { return localStorage.getItem("lastFirstName") ?? ""; } catch { return ""; }
  });
  const [lastName, setLastName] = useState(() => {
    if (row.personName) return row.personName.trim().split(/\s+/).slice(1).join(" ");
    try { return localStorage.getItem("lastLastName") ?? ""; } catch { return ""; }
  });
  const personName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [soupIds, setSoupIds] = useState<(number | null)[]>(
    row.soupItemId2 != null ? [row.soupItemId, row.soupItemId2] : [row.soupItemId]
  );
  const [mealEntries, setMealEntries] = useState<{ itemId: number | null; count: number }[]>([
    { itemId: row.mainItemId, count: row.mealCount || 1 },
    ...row.extraMealItems.map((e) => ({ itemId: e.item.id, count: e.count })),
  ]);
  const [rollCount, setRollCount] = useState(row.rollCount);
  const [breadDumplingCount, setBreadDumplingCount] = useState(row.breadDumplingCount);
  const [potatoDumplingCount, setPotatoDumplingCount] = useState(row.potatoDumplingCount);
  const [ketchupCount, setKetchupCount] = useState(row.ketchupCount);
  const [tatarkaCount, setTatarkaCount] = useState(row.tatarkaCount);
  const [bbqCount, setBbqCount] = useState(row.bbqCount);
  const [note, setNote] = useState(row.note);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const mounted = useMounted();

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; currentY: number } | null>(null);
  const touchDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCancel = () => { if (isNew) onDelete(); else onClose(); };
  const handleCancelRef = useRef(handleCancel);
  useEffect(() => { handleCancelRef.current = handleCancel; });

  useEffect(() => {
    return () => {
      if (touchDismissTimer.current) clearTimeout(touchDismissTimer.current);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const body = sheetRef.current?.querySelector(".modal-sheet__body") as HTMLElement | null;
    if (body && body.scrollTop > 0) return;
    dragState.current = { startY: e.touches[0].clientY, currentY: 0 };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragState.current || !sheetRef.current) return;
    const delta = e.touches[0].clientY - dragState.current.startY;
    if (delta <= 0) { dragState.current = null; sheetRef.current.style.transform = ""; return; }
    dragState.current.currentY = delta;
    sheetRef.current.style.transition = "none";
    sheetRef.current.style.transform = `translateY(${delta}px)`;
  };

  const handleTouchEnd = () => {
    if (!dragState.current || !sheetRef.current) return;
    const { currentY } = dragState.current;
    dragState.current = null;
    if (currentY > 80) {
      sheetRef.current.style.transition = "transform 0.25s ease-in";
      sheetRef.current.style.transform = "translateY(110%)";
      touchDismissTimer.current = setTimeout(() => handleCancelRef.current(), 220);
    } else {
      sheetRef.current.style.transition = "transform 0.3s cubic-bezier(.2,.8,.2,1)";
      sheetRef.current.style.transform = "";
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleCancelRef.current(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // body má overflow:hidden globálně — žádný scroll lock nutný

  const hasFood =
    soupIds.some((id) => id != null) ||
    mealEntries.some((e) => e.itemId != null) ||
    rollCount > 0 || breadDumplingCount > 0 || potatoDumplingCount > 0;

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const isDuplicateName =
    personName.trim() !== "" &&
    normalizeName(personName) !== normalizeName(row.personName) &&
    existingNames.some((n) => normalizeName(n) === normalizeName(personName));
  const showMealTip = /\d/.test(lastName) || /\d/.test(firstName);

  const handleSave = () => {
    if (!firstName.trim()) {
      setValidationError("Zadejte křestní jméno.");
      return;
    }
    if (!lastName.trim()) {
      setValidationError("Zadejte příjmení.");
      return;
    }
    if (!hasFood) {
      setValidationError("Vyberte alespoň jedno jídlo nebo přílohu.");
      return;
    }
    if (isDuplicateName) {
      setValidationError(`„${personName.trim()}" už v objednávce je.`);
      return;
    }
    setValidationError(null);
    doSave();
  };

  const doSave = () => {
    try { localStorage.setItem("lastFirstName", firstName.trim()); localStorage.setItem("lastLastName", lastName.trim()); } catch { /* */ }
    const firstMeal = mealEntries[0] ?? { itemId: null, count: 1 };
    const extraMeals: MealEntry[] = mealEntries
      .slice(1)
      .filter((e) => e.itemId != null)
      .map((e) => ({ itemId: e.itemId!, count: e.count }));
    onSave({
      personName,
      soupItemId: soupIds[0] ?? null,
      soupItemId2: soupIds.length > 1 ? (soupIds[1] ?? null) : null,
      mainItemId: firstMeal.itemId,
      mealCount: firstMeal.count,
      extraMeals,
      rollCount, breadDumplingCount, potatoDumplingCount,
      ketchupCount, tatarkaCount, bbqCount, note,
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        ref={sheetRef}
      >
        <div className="modal-sheet__drag-handle" aria-hidden />
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="edit-modal-title">{isNew ? "Přidat objednávku" : "Upravit objednávku"}</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
            onClick={handleCancel}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body">
          <div className="modal-field">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label className="modal-label" htmlFor="modal-firstname">Jméno</label>
                <input
                  autoFocus
                  autoComplete="given-name"
                  className={`modal-input${/\d/.test(firstName) ? " modal-input--error" : ""}`}
                  id="modal-firstname"
                  onChange={(e) => { setFirstName(e.target.value); setValidationError(null); }}
                  placeholder="Jan"
                  type="text"
                  value={firstName}
                />
                {/\d/.test(firstName) && (
                  <p className="mt-1 text-[11.5px] text-red-600 font-medium">Odstraň číslo ze jména.</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-label" htmlFor="modal-lastname">Příjmení</label>
                <input
                  autoComplete="family-name"
                  className={`modal-input${/\d/.test(lastName) ? " modal-input--error" : ""}`}
                  id="modal-lastname"
                  onChange={(e) => { setLastName(e.target.value); setValidationError(null); }}
                  placeholder="Novák"
                  type="text"
                  value={lastName}
                />
                {/\d/.test(lastName) && (
                  <p className="mt-1 text-[11.5px] text-red-600 font-medium">Odstraň číslo z příjmení.</p>
                )}
              </div>
            </div>
            {isDuplicateName && (
              <div className="mt-1 px-3 py-2 rounded-xl text-[12px] text-amber-700 font-medium flex items-center gap-1.5"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <MIcon name="warning" size={13} style={{ color: "#d97706", flexShrink: 0 }} />
                Toto jméno už v objednávce je.
              </div>
            )}
          </div>

          {soupIds.map((soupId, idx) => (
            <div className="modal-field" key={`soup-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-soup-${idx}`}>
                  {idx === 0 ? "Polévka" : "Druhá polévka"}
                  {defaultSoupPrice != null && <span className="modal-label-price">{defaultSoupPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button className="modal-remove-second" onClick={() => setSoupIds((prev) => prev.slice(0, -1))} type="button">
                    × odebrat
                  </button>
                )}
              </div>
              <MenuSelect
                id={`modal-soup-${idx}`}
                value={soupId}
                onChange={(val) => setSoupIds((prev) => prev.map((id, i) => i === idx ? val : id))}
                options={soups}
                placeholder="Vybrat polévku"
              />
            </div>
          ))}
          {soupIds.length < 2 && soupIds[0] != null && (
            <button className="modal-add-second" onClick={() => setSoupIds((prev) => [...prev, null])} type="button">
              <MIcon name="add" size={14} style={{ color: "#D97706" }} />
              Přidat druhou polévku
            </button>
          )}

          {mealEntries.map((entry, idx) => (
            <div className="modal-field" key={`meal-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="modal-label" htmlFor={`modal-meal-${idx}`}>
                  {idx === 0 ? "Jídlo" : `Jídlo ${idx + 1}`}
                  {defaultMealPrice != null && <span className="modal-label-price">{defaultMealPrice} Kč</span>}
                </label>
                {idx > 0 && (
                  <button className="modal-remove-second" onClick={() => setMealEntries((prev) => prev.filter((_, i) => i !== idx))} type="button">
                    × odebrat
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <MenuSelect
                  id={`modal-meal-${idx}`}
                  value={entry.itemId}
                  onChange={(val) => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, itemId: val } : ent))}
                  options={meals}
                  placeholder="Vybrat jídlo"
                  style={{ flex: 1, width: "auto", minWidth: 0 }}
                />
                {entry.itemId && (
                  <div className="modal-count-stepper">
                    <button
                      className="modal-count-btn"
                      disabled={entry.count <= 1}
                      onClick={() => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, count: Math.max(1, ent.count - 1) } : ent))}
                      type="button"
                    >−</button>
                    <span className="modal-count-val">{entry.count}×</span>
                    <button
                      className="modal-count-btn"
                      disabled={entry.count >= 10}
                      onClick={() => setMealEntries((prev) => prev.map((ent, i) => i === idx ? { ...ent, count: Math.min(10, ent.count + 1) } : ent))}
                      type="button"
                    >+</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {mealEntries[0]?.itemId != null && (
            <div style={{ position: "relative" }}>
              {showMealTip && (
                <div className="meal-tip-callout">
                  Víc jídel pro sebe? Přidej je sem — není třeba nová objednávka.
                </div>
              )}
              <button
                className={`modal-add-second${showMealTip ? " modal-add-second--pulse" : ""}`}
                onClick={() => setMealEntries((prev) => [...prev, { itemId: null, count: 1 }])}
                type="button"
              >
                <MIcon name="add" size={14} style={{ color: showMealTip ? "#b91c1c" : "#c2410c" }} />
                Přidat další jídlo do objednávky
              </button>
            </div>
          )}

          <div className="modal-field">
            <label className="modal-label" htmlFor="modal-note">Poznámka k jídlu</label>
            <textarea
              className="modal-note"
              id="modal-note"
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. bez špenátu, bez zelí..."
              rows={2}
              value={note}
            />
          </div>

          <div className="modal-extras">
            <span className="modal-label" style={{ padding: "0.55rem 0.85rem 0.45rem", background: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.5)", display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Přílohy a doplňky</span>
            <ModalStepper label="Houska" onChange={setRollCount} price={ep.roll} value={rollCount} />
            <ModalStepper label="Houskový knedlík" onChange={setBreadDumplingCount} price={ep.breadDumpling} value={breadDumplingCount} />
            <ModalStepper label="Bramborový knedlík" onChange={setPotatoDumplingCount} price={ep.potatoDumpling} value={potatoDumplingCount} />
            <ModalStepper label="Kečup" onChange={setKetchupCount} price={ep.ketchup} value={ketchupCount} />
            <ModalStepper label="Tatarka" onChange={setTatarkaCount} price={ep.tatarka} value={tatarkaCount} />
            <ModalStepper label="BBQ omáčka" onChange={setBbqCount} price={ep.bbq} value={bbqCount} />
          </div>
        </div>
        {validationError && (
          <div role="alert" className="mx-4 mb-2 px-3 py-2 rounded-xl text-[12px] text-red-700 font-medium flex items-center gap-1.5"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}>
            <MIcon name="warning" size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
            {validationError}
          </div>
        )}
        <div className="modal-sheet__footer">
          {!isNew && <button className="modal-btn modal-btn--danger" onClick={() => setShowDeleteConfirm(true)} type="button">Smazat</button>}
          <button className="modal-btn modal-btn--secondary" onClick={handleCancel} type="button">Zrušit</button>
          <button className="modal-btn modal-btn--primary" disabled={isDuplicateName || showMealTip} onClick={handleSave} type="button">Uložit</button>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          message="Objednávka této osoby bude odstraněna."
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={onDelete}
          title="Smazat objednávku"
        />
      )}
    </div>,
    document.body
  );
}
