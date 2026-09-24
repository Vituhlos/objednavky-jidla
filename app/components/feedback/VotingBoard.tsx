"use client";

import { useEffect, useState } from "react";
import { getCategoryMeta, type VotableFeedback } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { useFlipList } from "./useFlipList";
import { VoteButtons } from "./VoteButtons";
import { useVotes, type Tally } from "./useVotes";

const score = (t: Tally) => t.up - t.down;

/** Pořadí podle hlasů; při shodě to, co má víc 👍, pak novější. */
function rank(items: VotableFeedback[], tallies: Record<number, Tally>): number[] {
  return [...items]
    .sort((a, b) => {
      const ta = tallies[a.id] ?? a, tb = tallies[b.id] ?? b;
      return score(tb) - score(ta) || tb.up - ta.up || b.id - a.id;
    })
    .map((i) => i.id);
}

/**
 * „Co chystáme“: návrhy správce a připomínky, které dal k hlasování pod svým
 * názvem. Karta se ukáže jen když je o čem hlasovat.
 */
export function VotingBoard({ items }: { items: VotableFeedback[] }) {
  const { tallies, mine, error, vote } = useVotes(items);
  const [order, setOrder] = useState(() => rank(items, {}));
  const listRef = useFlipList<HTMLUListElement>(order);

  // Přeskládat až po chvilce — nejdřív ať palec dokončí animaci a tlačítko
  // neuteče zpod prstu hned po kliknutí.
  useEffect(() => {
    const id = setTimeout(() => setOrder(rank(items, tallies)), 700);
    return () => clearTimeout(id);
  }, [items, tallies]);

  if (items.length === 0) return null;
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(59,130,246,0.06)" }}>
        <MIcon name="calendar_today" size={17} style={{ color: "#2563eb" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Co chystáme</h2>
        <span className="text-[11px] text-stone-500">Co na to říkáš?</span>
      </div>
      <ul ref={listRef} className="divide-y divide-white/50">
        {order.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const cat = getCategoryMeta(item.category);
          const t = tallies[item.id] ?? { up: item.up, down: item.down };
          const total = t.up + t.down;
          return (
            <li key={item.id} data-flip-id={item.id} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className="emoji text-[16px] leading-none">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-stone-800 leading-snug break-words">{item.summary}</p>
                {total > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="fb-approval flex-1 max-w-[140px]" aria-hidden="true">
                      <div className="fb-approval__fill" style={{ width: `${Math.round((t.up / total) * 100)}%` }} />
                    </div>
                    <span className="text-[10.5px] text-stone-400 tabular-nums">{Math.round((t.up / total) * 100)} % pro</span>
                  </div>
                )}
              </div>
              <VoteButtons label={item.summary} mine={mine[item.id]} onVote={(v) => void vote(item.id, v)} tally={t} />
            </li>
          );
        })}
      </ul>
      {error && <p className="px-4 pb-3 text-[11.5px] text-red-600" role="alert">{error}</p>}
    </section>
  );
}
