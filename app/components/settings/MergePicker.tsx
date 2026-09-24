"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { actionMergeFeedback } from "@/app/actions";
import { getCategoryMeta, type FeedbackEntry } from "@/lib/feedback-meta";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";

const preview = (text: string) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
};

/**
 * Sloučení duplicity do jiné připomínky. Nabízí nejdřív stejnou kategorii,
 * pak ostatní; sloučené a mazané se nenabízí. Vrátit to nejde — hlasy se
 * přesunou a sečtou, proto potvrzení.
 */
export function MergePicker({
  entry,
  entries,
  getPin,
  onChange,
}: {
  entry: FeedbackEntry;
  entries: FeedbackEntry[];
  getPin: () => string;
  onChange: Dispatch<SetStateAction<FeedbackEntry[]>>;
}) {
  const [target, setTarget] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const candidates = entries
    .filter((e) => e.id !== entry.id && e.mergedInto === null)
    .sort((a, b) => Number(b.category === entry.category) - Number(a.category === entry.category) || b.id - a.id);
  if (candidates.length === 0) return null;
  const targetEntry = candidates.find((e) => String(e.id) === target);

  const merge = () => {
    if (!targetEntry) return;
    setError(null);
    startTransition(async () => {
      try {
        const fresh = await actionMergeFeedback(getPin(), entry.id, targetEntry.id);
        setConfirm(false);
        onChange(fresh);
      } catch (err) {
        setConfirm(false);
        setError(err instanceof Error ? err.message : "Sloučení se nepovedlo.");
      }
    });
  };

  return (
    <div className="modal-field">
      <label className="modal-label" htmlFor={`fb-merge-${entry.id}`}>
        Sloučit s podobnou <span className="modal-label-price">duplicita zmizí z nástěnky, hlasy se sečtou</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <select
          className="modal-input flex-1 min-w-[220px]"
          id={`fb-merge-${entry.id}`}
          onChange={(e) => setTarget(e.target.value)}
          value={target}
        >
          <option value="">Vyberte připomínku…</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              #{e.id} · {getCategoryMeta(e.category).short}{e.isProposal ? " (váš návrh)" : ""} · {preview(e.isProposal ? e.voteTitle : e.message)}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600 disabled:opacity-50"
          disabled={!targetEntry || isPending}
          onClick={() => setConfirm(true)}
          type="button"
        >
          <MIcon name="link" size={14} />
          Sloučit
        </button>
      </div>
      {error && <p className="text-[12px] text-red-500" role="alert">{error}</p>}
      {confirm && targetEntry && (
        <ConfirmModal
          title={`Sloučit do #${targetEntry.id}?`}
          confirmLabel="Sloučit"
          message="Hlasy se přesunou a sečtou, tahle připomínka zmizí z nástěnky a její autor uvidí stav a odpověď té druhé. Vrátit to nejde."
          isPending={isPending}
          onConfirm={merge}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
