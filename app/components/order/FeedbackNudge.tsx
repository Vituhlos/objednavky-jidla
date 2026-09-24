"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MIcon from "../MIcon";

// Věta se střídá po dnech, ať banner nezevšední. Vybírá se podle data, ne
// náhodně — server i prohlížeč tak vykreslí totéž.
const LINES = [
  { lead: "Něco nefunguje?", rest: "Napiš nám, ať to spravíme dřív, než vystydne oběd." },
  { lead: "Stížnosti na knedlíky řeš s kuchyní.", rest: "Stížnosti na appku s námi." },
  { lead: "Máš nápad, jak objednávat rychleji?", rest: "Sem s ním. Nejlepší nápady opravdu děláme." },
  { lead: "Appka tě zlobí?", rest: "Postěžuj si, klidně i bez jména." },
  { lead: "Polévku nevylepšíme.", rest: "Appku ale ano. Řekni nám, co ti v ní chybí." },
] as const;

const DISMISS_KEY = "feedbackNudgeHiddenUntil";
const DISMISS_DAYS = 14;

function pickLine(date: string) {
  const n = [...date].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return LINES[n % LINES.length];
}

/**
 * Pozvánka k připomínkám pod objednávkou — místo plovoucího tlačítka, které
 * by překáželo na každé stránce. Kdo ji zavře, 14 dní ji neuvidí.
 */
export function FeedbackNudge({ date }: { date: string }) {
  // Až po načtení: jestli ji člověk zavřel, ví jen prohlížeč. Bez toho by
  // zavřený banner na okamžik problikl.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hiddenUntil = 0;
    try { hiddenUntil = Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch { /* */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stav je jen v prohlížeči
    setVisible(Date.now() > hiddenUntil);
  }, []);

  if (!visible) return null;
  const line = pickLine(date);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)); } catch { /* */ }
    setVisible(false);
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
