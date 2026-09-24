"use client";

import { getCategoryMeta, type FeedbackStatus, type OwnFeedback } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { formatFeedbackDate } from "./feedback-utils";
import { StatusBadge } from "./StatusBadge";

// Pro autora srozumitelněji než interní názvy stavů
const OWN_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Čeká na přečtení",
  read: "Přečteno",
  planned: "V plánu",
  done: "Hotovo",
  rejected: "Nebude se dělat",
};

/**
 * Připomínky odeslané z tohoto prohlížeče: vlastní text, stav a odpověď správce.
 * Karta se ukáže, až když nějaká je — prázdná by jen zabírala místo.
 */
export function MyFeedback({ items, onForget }: { items: OwnFeedback[]; onForget: (id: number) => void }) {
  if (items.length === 0) return null;

  return (
    <section className="glass rounded-3xl overflow-hidden fade-up">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="history" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Moje připomínky</h2>
        <span className="text-[11px] text-stone-500">{items.length}</span>
      </div>
      <ul className="divide-y divide-white/50">
        {items.map((item) => {
          const cat = getCategoryMeta(item.category);
          return (
            <li key={item.id} className="group px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="emoji text-[15px] leading-none">{cat.emoji}</span>
                <StatusBadge label={OWN_STATUS_LABELS[item.status]} status={item.status} />
                <span className="text-[11px] text-stone-400 ml-auto">{formatFeedbackDate(item.createdAt)}</span>
                <button
                  aria-label="Skrýt z mého seznamu"
                  className="w-6 h-6 -mr-1 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-black/5 transition"
                  onClick={() => onForget(item.id)}
                  title="Skrýt z mého seznamu"
                  type="button"
                >
                  <MIcon name="close" size={13} />
                </button>
              </div>
              <p className="text-[12.5px] text-stone-700 leading-snug line-clamp-2 break-words">{item.message}</p>
              {item.reply && (
                <p className="text-[12.5px] text-stone-800 leading-snug whitespace-pre-line break-words pl-2.5 border-l-2" style={{ borderColor: "rgba(234,88,12,0.45)" }}>
                  <span className="font-semibold">Odpověď: </span>{item.reply}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
