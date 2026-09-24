"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatReleaseDate, type PublicReleaseNote } from "@/lib/release-notes";
import MIcon from "../MIcon";

/**
 * „Co je nového“ — veřejná část novinek (`forEveryone`). Technické novinky pro
 * správce zůstávají v Nastavení → O aplikaci.
 *
 * Ve sloupci je jen poslední novinka; celá historie je v okně, které vypadá
 * stejně jako „Co je nového“ v Nastavení.
 */
export function WhatsNew({ notes }: { notes: PublicReleaseNote[] }) {
  const [showAll, setShowAll] = useState(false);
  if (notes.length === 0) return null;
  const latest = notes[0];

  return (
    <section className="glass rounded-3xl overflow-hidden" aria-labelledby="whats-new-title">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="notifications" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1" id="whats-new-title">Co je nového</h2>
        <time className="text-[11px] text-stone-400" dateTime={latest.date}>{formatReleaseDate(latest.date)}</time>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1.5">
        <p className="font-semibold text-[13px] text-stone-900 leading-snug">{latest.title}</p>
        {latest.forEveryone.map((item) => (
          <p key={item} className="text-[12.5px] text-stone-600 leading-snug">{item}</p>
        ))}
      </div>

      {notes.length > 1 && (
        <button
          className="w-full flex items-center gap-1 px-4 py-2.5 border-t border-white/50 text-[12px] font-semibold text-amber-700 hover:bg-white/40 transition"
          onClick={() => setShowAll(true)}
          type="button"
        >
          Starší novinky
          <MIcon name="chevron_right" size={16} className="ml-auto text-stone-400" />
        </button>
      )}

      {showAll && <AllNotesModal notes={notes} onClose={() => setShowAll(false)} />}
    </section>
  );
}

function AllNotesModal({ notes, onClose }: { notes: PublicReleaseNote[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portál do <body>: `.glass` karty má backdrop-filter, a ten by z `position: fixed`
  // udělal pozici vůči kartě — okno by se vykreslilo v ní a pod spodní lištou.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        aria-labelledby="whats-new-modal-title"
        aria-modal="true"
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        style={{ maxWidth: 520 }}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="whats-new-modal-title">Co je nového</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
            onClick={onClose}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body space-y-4">
          {notes.map((note) => (
            <div key={note.version} className="glass-soft rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display font-bold text-[14px] text-stone-900 leading-snug">{note.title}</p>
                <time className="text-[11px] text-stone-400 shrink-0" dateTime={note.date}>{formatReleaseDate(note.date)}</time>
              </div>
              {note.forEveryone.map((item) => (
                <p key={item} className="text-[12.5px] text-stone-600 leading-relaxed">{item}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
