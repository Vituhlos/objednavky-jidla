"use client";

import { useState } from "react";
import { formatReleaseDate, type PublicReleaseNote } from "@/lib/release-notes";
import MIcon from "../MIcon";

const VISIBLE = 2;

/**
 * „Co je nového“ — veřejná část novinek (`forEveryone`). Technické novinky pro
 * správce zůstávají v Nastavení → O aplikaci.
 */
export function WhatsNew({ notes }: { notes: PublicReleaseNote[] }) {
  const [showAll, setShowAll] = useState(false);
  if (notes.length === 0) return null;
  const shown = showAll ? notes : notes.slice(0, VISIBLE);
  const hidden = notes.length - shown.length;

  return (
    <section className="glass rounded-3xl overflow-hidden" aria-labelledby="whats-new-title">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="history" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1" id="whats-new-title">Co je nového</h2>
        <span className="text-[11px] text-stone-500 font-mono">v{notes[0].version}</span>
      </div>

      <div className="flex flex-col divide-y divide-white/50">
        {shown.map((note) => (
          <article key={note.version} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-[13px] text-stone-800 leading-snug">{note.title}</h3>
              <time className="text-[11px] text-stone-400 shrink-0" dateTime={note.date}>{formatReleaseDate(note.date)}</time>
            </div>
            <ul className="mt-1.5 space-y-1">
              {note.forEveryone.map((item) => (
                <li key={item} className="flex gap-2 text-[12.5px] text-stone-600 leading-snug">
                  <span aria-hidden="true" className="text-amber-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {notes.length > VISIBLE && (
        <button
          className="w-full flex items-center justify-center gap-1 px-4 py-2.5 border-t border-white/50 text-[12px] font-semibold text-stone-500 hover:bg-white/40 transition"
          onClick={() => setShowAll((v) => !v)}
          type="button"
        >
          {showAll ? "Méně" : `Starší novinky (${hidden})`}
          <MIcon name={showAll ? "expand_less" : "expand_more"} size={16} />
        </button>
      )}
    </section>
  );
}
