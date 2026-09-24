"use client";

import { getCategoryMeta, pluralizeVotes, type VotableFeedback } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { useVotes } from "./useVotes";

/**
 * „Co chystáme“: nápady, které správce zveřejnil k hlasování.
 * Text je jeho shrnutí, ne původní připomínka. Karta se ukáže jen když je o čem hlasovat.
 */
export function VotingBoard({ items }: { items: VotableFeedback[] }) {
  const { counts, voted, error, toggle } = useVotes(items);
  if (items.length === 0) return null;

  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(59,130,246,0.06)" }}>
        <MIcon name="calendar_today" size={17} style={{ color: "#2563eb" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Co chystáme</h2>
        <span className="text-[11px] text-stone-500">Hlasuj, co chceš dřív</span>
      </div>
      <ul className="divide-y divide-white/50">
        {items.map((item) => {
          const cat = getCategoryMeta(item.category);
          const on = voted.has(item.id);
          const count = counts[item.id] ?? item.votes;
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className="emoji text-[16px] leading-none">{cat.emoji}</span>
              <p className="flex-1 min-w-0 text-[12.5px] text-stone-800 leading-snug break-words">{item.summary}</p>
              <button
                aria-label={`${on ? "Vzít zpět hlas" : "Chci taky"}: ${item.summary}. Zatím ${pluralizeVotes(count)}.`}
                aria-pressed={on}
                className={`fb-vote${on ? " fb-vote--on" : ""}`}
                onClick={() => void toggle(item.id)}
                title={on ? "Vzít hlas zpět" : "Chci taky"}
                type="button"
              >
                <span aria-hidden="true" className="emoji text-[14px] leading-none">👍</span>
                <span className="tabular-nums">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="px-4 pb-3 text-[11.5px] text-red-600" role="alert">{error}</p>}
    </section>
  );
}
