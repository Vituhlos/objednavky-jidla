"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MIcon from "../MIcon";
import { NUDGE_LINES, pickNextLine } from "./feedback-nudge-lines";

const DISMISS_KEY = "feedbackNudgeHiddenUntil";
const DISMISS_DAYS = 14;
const LAST_LINE_KEY = "feedbackNudgeLastLine";

/**
 * Pozvánka k připomínkám pod objednávkou — místo plovoucího tlačítka, které
 * by překáželo na každé stránce. Kdo ji zavře, 14 dní ji neuvidí.
 */
export function FeedbackNudge() {
  // Až po načtení: jestli ji člověk zavřel a jakou větu viděl minule, ví jen
  // prohlížeč. Náhodná věta na serveru by se navíc s prohlížečem neshodla.
  const [lineIndex, setLineIndex] = useState<number | null>(null);

  useEffect(() => {
    let hiddenUntil = 0;
    let last: number | null = null;
    try {
      hiddenUntil = Number(localStorage.getItem(DISMISS_KEY)) || 0;
      const stored = localStorage.getItem(LAST_LINE_KEY);
      last = stored === null ? null : Number(stored);
    } catch { /* */ }
    if (Date.now() <= hiddenUntil) return;
    // Při každém otevření jiná věta, nikdy stejná dvakrát po sobě
    const next = pickNextLine(NUDGE_LINES.length, last);
    try { localStorage.setItem(LAST_LINE_KEY, String(next)); } catch { /* */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- výběr závisí na prohlížeči
    setLineIndex(next);
  }, []);

  if (lineIndex === null) return null;
  const line = NUDGE_LINES[lineIndex];

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)); } catch { /* */ }
    setLineIndex(null);
  };

  return (
    <div className="glass rounded-2xl pl-4 pr-2 py-2.5 flex items-center gap-3 mx-auto w-fit max-w-full fade-up">
      <div className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.14)" }}>
        <MIcon name="feedback" size={17} fill style={{ color: "#D97706" }} />
      </div>
      <p className="text-[12.5px] text-stone-700 leading-snug min-w-0">
        <strong className="text-stone-900">{line.lead}</strong>{" "}
        <span className="text-stone-500">{line.rest}</span>
      </p>
      <Link
        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-xl glass-btn text-orange-700"
        href="/pripominky"
      >
        <span className="hidden sm:inline">Napsat připomínku</span>
        <span className="sm:hidden">Napsat</span>
      </Link>
      <button
        aria-label="Skrýt na 14 dní"
        className="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-black/5 transition"
        onClick={dismiss}
        title="Skrýt na 14 dní"
        type="button"
      >
        <MIcon name="close" size={14} />
      </button>
    </div>
  );
}
