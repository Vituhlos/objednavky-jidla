"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { actionAddProposal } from "@/app/actions";
import { FEEDBACK_CATEGORIES, FEEDBACK_LIMITS, PUBLIC_CATEGORIES, type FeedbackCategory, type FeedbackEntry } from "@/lib/feedback-meta";
import MIcon from "../MIcon";

const CATEGORIES = FEEDBACK_CATEGORIES.filter((c) => PUBLIC_CATEGORIES.includes(c.id));

/** Vlastní návrh do „Co chystáme“ — lidé na něj dají 👍 nebo 👎. */
export function ProposalForm({ getPin, onChange }: { getPin: () => string; onChange: Dispatch<SetStateAction<FeedbackEntry[]>> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("napad");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
        onClick={() => setOpen(true)}
        type="button"
      >
        <MIcon name="add" size={14} />
        Vlastní návrh k hlasování
      </button>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const entry = await actionAddProposal(getPin(), { title, category });
        onChange((prev) => [entry, ...prev]);
        setTitle("");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Návrh se nepodařilo uložit.");
      }
    });
  };

  return (
    <form
      className="flex flex-col gap-2 p-3 rounded-2xl fade-up"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
    >
      <label className="modal-label" htmlFor="fb-proposal">
        Nový návrh <span className="modal-label-price">objeví se v „Co chystáme“, lidé dají 👍 nebo 👎</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <select
          aria-label="Kategorie"
          className="modal-input !w-auto"
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          value={category}
        >
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.short}</option>)}
        </select>
        <input
          autoFocus
          className="modal-input flex-1 min-w-[200px]"
          id="fb-proposal"
          maxLength={FEEDBACK_LIMITS.voteTitleMax}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Např. „Objednávka na celý týden dopředu“"
          type="text"
          value={title}
        />
      </div>
      {error && <p className="text-[12px] text-red-500" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-700"
          disabled={isPending || title.trim().length < 3}
          type="submit"
        >
          <MIcon name="check" size={14} />
          {isPending ? "Ukládám…" : "Přidat k hlasování"}
        </button>
        <button className="text-[12px] font-semibold text-stone-500 px-2 py-2" onClick={() => { setOpen(false); setError(null); }} type="button">
          Zrušit
        </button>
      </div>
    </form>
  );
}
