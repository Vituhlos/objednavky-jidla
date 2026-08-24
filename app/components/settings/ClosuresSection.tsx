"use client";

import { useEffect, useState, useTransition } from "react";
import {
  actionAddClosure,
  actionDeleteClosure,
  actionGetClosures,
  actionUpdateClosure,
} from "@/app/actions";
import type { Closure } from "@/lib/closures";
import { DEFAULT_CLOSURE_ICON } from "@/lib/closure-icons";
import { ConfirmModal } from "../ConfirmModal";
import { EmojiPicker } from "../EmojiPicker";
import MIcon from "../MIcon";
import { formatClosureRange, validateClosureRange } from "./settings-utils";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/**
 * Období, kdy se nevaří — dovolená, svátky, odstávka.
 *
 * Seznam se nenačítá se stránkou, ale až po odemčení: je za PINem a nemá smysl
 * na něj sahat, dokud ho nikdo neuvidí.
 *
 * Formulář slouží zároveň k zakládání i úpravě; `editingClosureId === null`
 * rozlišuje který režim. Upravovaný záznam se ze seznamu nad formulářem
 * schová, aby se tentýž údaj nezobrazoval dvakrát a rozepsaná změna se
 * nepřekrývala s původní hodnotou.
 *
 * Rozsah se kontroluje při psaní (`validateClosureRange`) — chyba blokuje
 * uložení, varování ne.
 */
export function ClosuresSection({ isActive }: { isActive: boolean }) {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoaded, setClosuresLoaded] = useState(false);
  const [showAddClosure, setShowAddClosure] = useState(false);
  // null = zakládá se nové zavření, číslo = upravuje se existující
  const [editingClosureId, setEditingClosureId] = useState<number | null>(null);
  const [newClosureFrom, setNewClosureFrom] = useState("");
  const [newClosureTo, setNewClosureTo] = useState("");
  const [newClosureLabel, setNewClosureLabel] = useState("");
  const [newClosureNote, setNewClosureNote] = useState("");
  const [newClosureIcon, setNewClosureIcon] = useState(DEFAULT_CLOSURE_ICON);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [confirmDeleteClosure, setConfirmDeleteClosure] = useState<Closure | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (closuresLoaded) return;
    actionGetClosures()
      .then((list) => { setClosures(list); setClosuresLoaded(true); })
      .catch(() => setClosureError("Nepodařilo se načíst zavření."));
  }, [closuresLoaded]);

  const closureCheck = validateClosureRange(
    newClosureFrom,
    newClosureTo,
    closures.filter((c) => c.id !== editingClosureId),
    new Date().toISOString().slice(0, 10)
  );

  const resetClosureForm = () => {
    setShowAddClosure(false);
    setEditingClosureId(null);
    setNewClosureFrom("");
    setNewClosureTo("");
    setNewClosureLabel("");
    setNewClosureNote("");
    setNewClosureIcon(DEFAULT_CLOSURE_ICON);
  };

  const startEditClosure = (c: Closure) => {
    setEditingClosureId(c.id);
    setNewClosureFrom(c.startDate);
    setNewClosureTo(c.endDate);
    setNewClosureLabel(c.label);
    setNewClosureNote(c.note);
    setNewClosureIcon(c.icon);
    setShowAddClosure(true);
    setClosureError(null);
  };

  const handleSaveClosure = () => {
    setClosureError(null);
    startTransition(async () => {
      try {
        const res = editingClosureId === null
          ? await actionAddClosure(newClosureFrom, newClosureTo, newClosureLabel, newClosureNote, newClosureIcon)
          : await actionUpdateClosure(editingClosureId, newClosureFrom, newClosureTo, newClosureLabel, newClosureNote, newClosureIcon);
        if (!res.ok) { setClosureError(res.error); return; }
        setClosures((prev) =>
          [...prev.filter((c) => c.id !== res.closure.id), res.closure]
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
        );
        resetClosureForm();
      } catch (err) {
        setClosureError(err instanceof Error ? err.message : "Zavření se nepodařilo uložit.");
      }
    });
  };

  const handleDeleteClosure = (closure: Closure) => {
    setClosureError(null);
    startTransition(async () => {
      try {
        await actionDeleteClosure(closure.id);
        setClosures((prev) => prev.filter((c) => c.id !== closure.id));
        setConfirmDeleteClosure(null);
      } catch (err) {
        setClosureError(err instanceof Error ? err.message : "Zavření se nepodařilo smazat.");
      }
    });
  };

  if (!isActive) return null;

  return (
    <SettingsSection icon="event_busy" title="Zavřeno / dovolená">
      <p className="text-[12.5px] text-stone-500">
        Období, kdy se v LIMA nevaří. Zobrazí se v přepínači dnů na objednávkové
        stránce a vypne automatické odeslání. Lze zadat dopředu, nezávisle na
        importu jídelníčku.
      </p>
      {closureError && <p className="text-[12px] text-red-500">{closureError}</p>}
      {closuresLoaded && closures.length === 0 && !showAddClosure && (
        <p className="text-[12.5px] text-stone-400">Zatím nic — provoz běží normálně.</p>
      )}
      <div className="flex flex-col gap-2">
        {closures.filter((c) => c.id !== editingClosureId).map((c) => (
          <div className="glass-soft rounded-2xl px-3 py-2.5 flex items-center gap-3" key={c.id}>
            <span className="emoji text-[18px] leading-none shrink-0" aria-hidden>{c.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-stone-700">
                {formatClosureRange(c.startDate, c.endDate)}
              </div>
              {c.label && <div className="text-[12px] text-stone-500 truncate">{c.label}</div>}
              {c.note && <div className="text-[11.5px] text-stone-400 truncate">{c.note}</div>}
            </div>
            <button
              aria-label={`Upravit zavření ${formatClosureRange(c.startDate, c.endDate)}`}
              className="modal-btn modal-btn--secondary shrink-0"
              disabled={isPending}
              onClick={() => startEditClosure(c)}
              type="button"
            >
              Upravit
            </button>
            <button
              aria-label="Smazat zavření"
              className="modal-btn modal-btn--danger shrink-0"
              disabled={isPending}
              onClick={() => setConfirmDeleteClosure(c)}
              type="button"
            >
              Smazat
            </button>
          </div>
        ))}
      </div>
      {showAddClosure ? (
        <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SettingsField label="Od">
              <input className="modal-input" onChange={(e) => setNewClosureFrom(e.target.value)} type="date" value={newClosureFrom} />
            </SettingsField>
            <SettingsField label="Do">
              <input className="modal-input" onChange={(e) => setNewClosureTo(e.target.value)} type="date" value={newClosureTo} />
            </SettingsField>
            <SettingsField label="Popis">
              <input className="modal-input" onChange={(e) => setNewClosureLabel(e.target.value)} placeholder="např. Celozávodní dovolená" value={newClosureLabel} />
            </SettingsField>
          </div>
          {closureCheck.error && (
            <p className="flex items-start gap-1.5 text-[12px] text-red-600">
              <MIcon name="error" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {closureCheck.error}
            </p>
          )}
          {closureCheck.warning && (
            <p className="flex items-start gap-1.5 text-[12px] text-amber-700">
              <MIcon name="warning" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {closureCheck.warning}
            </p>
          )}
          <SettingsField hint="ukáže se v upozornění, v jídelníčku i v botovi" label="Ikona">
            <EmojiPicker onChange={setNewClosureIcon} value={newClosureIcon} />
          </SettingsField>
          <SettingsField hint="nepovinné — přidá se do upozornění na hlavní stránce; data se doplňují sama" label="Vlastní poznámka">
            <input className="modal-input" onChange={(e) => setNewClosureNote(e.target.value)} placeholder="např. Kdo chce oběd, musí si ho zajistit sám." value={newClosureNote} />
          </SettingsField>
          <div className="flex gap-2">
            <button
              className="modal-btn modal-btn--primary"
              disabled={isPending || !newClosureFrom || !newClosureTo || !!closureCheck.error}
              onClick={handleSaveClosure}
              type="button"
            >{editingClosureId === null ? "Přidat" : "Uložit změny"}</button>
            <button
              className="modal-btn modal-btn--secondary"
              onClick={resetClosureForm}
              type="button"
            >Zrušit</button>
          </div>
        </div>
      ) : (
        <button
          className="self-start inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-stone-600"
          onClick={() => setShowAddClosure(true)}
          type="button"
        >
          <MIcon name="add" size={14} /> Přidat zavření
        </button>
      )}
      {confirmDeleteClosure && (
        <ConfirmModal
          confirmLabel="Smazat"
          isPending={isPending}
          message={`${formatClosureRange(confirmDeleteClosure.startDate, confirmDeleteClosure.endDate)} — ${confirmDeleteClosure.label || "Dovolená"}. V těchto dnech se zase začne objednávat a auto-odeslání se obnoví.`}
          onClose={() => setConfirmDeleteClosure(null)}
          onConfirm={() => handleDeleteClosure(confirmDeleteClosure)}
          title="Smazat zavření"
        />
      )}
    </SettingsSection>
  );
}
