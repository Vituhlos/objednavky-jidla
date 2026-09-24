"use client";

import { useState } from "react";
import { formatReleaseDate, type PublicReleaseNote } from "@/lib/release-notes";
import MIcon from "../MIcon";

/**
 * „Co je nového“ — veřejná část novinek (`forEveryone`). Technické novinky pro
 * správce zůstávají v Nastavení → O aplikaci.
 *
 * Rozbalená je jen jedna verze (na začátku nejnovější), ostatní jsou jeden
 * řádek na ose. Jinak by z úzkého sloupce byla stěna textu.
 */
export function WhatsNew({ notes }: { notes: PublicReleaseNote[] }) {
  const [open, setOpen] = useState<string | null>(notes[0]?.version ?? null);
  if (notes.length === 0) return null;

  return (
    <section className="glass rounded-3xl overflow-hidden" aria-labelledby="whats-new-title">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="history" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1" id="whats-new-title">Co je nového</h2>
      </div>

      <ol className="fb-news">
        {notes.map((note) => {
          const expanded = open === note.version;
          const bodyId = `whats-new-${note.version}`;
          return (
            <li key={note.version}>
              <button
                aria-controls={bodyId}
                aria-expanded={expanded}
                className="fb-news__row"
                onClick={() => setOpen(expanded ? null : note.version)}
                type="button"
              >
                <span className={`flex-1 min-w-0 text-[13px] leading-snug ${expanded ? "font-semibold text-stone-900" : "text-stone-600"}`}>
                  {note.title}
                </span>
                <time className="text-[11px] text-stone-400 shrink-0" dateTime={note.date}>{formatReleaseDate(note.date)}</time>
              </button>
              {expanded && (
                <div className="fb-news__body space-y-1.5" id={bodyId}>
                  {note.forEveryone.map((item) => (
                    <p key={item} className="text-[12.5px] text-stone-600 leading-relaxed">{item}</p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
