"use client";

import { useMemo, useState } from "react";
import { getCategoryMeta, PUBLIC_STATUS_LABELS, WITHDRAWABLE_STATUSES, type PublicFeedbackItem } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { ExpandableText } from "./ExpandableText";
import { formatFeedbackDate } from "./feedback-utils";
import { StatusBadge } from "./StatusBadge";
import { useFlipList } from "./useFlipList";
import { VoteButtons } from "./VoteButtons";
import { useVotes } from "./useVotes";

type View = "new" | "top" | "closed";
const VIEWS: { id: View; label: string }[] = [
  { id: "new", label: "Nejnovější" },
  { id: "top", label: "Nejlepší" },
  { id: "closed", label: "Vyřízené" },
];
const PAGE = 6;

const isOpen = (item: PublicFeedbackItem) => WITHDRAWABLE_STATUSES.includes(item.status);

/**
 * „Připomínky ostatních“ jako nástěnka lístků: nápady, vzhled, mobil a jiné
 * hned po odeslání, bez jména. U vlastních se hlasovat nedá — místo palců je
 * „Tvoje“. Vyřízené (Hotovo, Nebude se dělat) mají vlastní záložku se stavem
 * a odpovědí správce; hlasovat o nich už nejde, počty zůstanou vidět.
 */
export function OthersFeedback({ items, ownIds }: { items: PublicFeedbackItem[]; ownIds: Set<number> }) {
  const { tallies, mine, error, vote } = useVotes(items);
  const [view, setView] = useState<View>("new");
  const [limit, setLimit] = useState(PAGE);

  const open = useMemo(() => items.filter(isOpen), [items]);
  const closed = useMemo(() => items.filter((i) => !isOpen(i)), [items]);

  // Řadí se podle hlasů z načtení stránky, ne živě — jinak by položka po
  // kliknutí utekla zpod prstu. Živě se přeskládá až přepnutím řazení.
  const list = useMemo(() => {
    if (view === "closed") return closed;
    if (view === "new") return open;
    return [...open].sort((a, b) => (b.up - b.down) - (a.up - a.down) || b.up - a.up || b.id - a.id);
  }, [open, closed, view]);
  const shown = list.slice(0, limit);
  const listRef = useFlipList<HTMLUListElement>(shown.map((i) => i.id));
  const views = VIEWS.filter((v) => (v.id === "closed" ? closed.length > 0 : open.length > 1 || v.id === "new"));

  return (
    <section className="glass rounded-3xl overflow-hidden" aria-labelledby="others-title">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40 flex-wrap" style={{ background: "rgba(245,158,11,0.07)" }}>
        <MIcon name="groups" size={17} style={{ color: "#D97706" }} />
        <h2 className="font-display font-bold text-[13.5px] text-stone-900 flex-1" id="others-title">Připomínky ostatních</h2>
        {views.length > 1 && (
          <div className="flex p-0.5 rounded-xl gap-0.5" role="group" aria-label="Zobrazení" style={{ background: "rgba(26,18,8,0.06)" }}>
            {views.map(({ id, label }) => (
              <button
                key={id}
                aria-pressed={view === id}
                className={`px-2.5 py-1 rounded-[10px] text-[11px] font-semibold transition-colors ${view === id ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                onClick={() => { setView(id); setLimit(PAGE); }}
                type="button"
              >
                {label}
                {id === "closed" && <span className="ml-1 text-stone-400 tabular-nums">{closed.length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <MIcon name="groups" size={22} style={{ color: "#94a3b8" }} />
          </div>
          <p className="empty-state__title">Zatím tu nic není</p>
          <p className="empty-state__sub">Nápady od ostatních se objeví tady, bez jména</p>
        </div>
      ) : (
        <ul ref={listRef} className="grid gap-2.5 p-3 sm:grid-cols-2">
          {shown.map((item) => {
            const cat = getCategoryMeta(item.category);
            const own = ownIds.has(item.id);
            const itemOpen = isOpen(item);
            const t = tallies[item.id] ?? item;
            return (
              <li key={item.id} data-flip-id={item.id} className={`fb-note${own ? " fb-note--own" : ""}${itemOpen ? "" : " fb-note--closed"}`}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
                  <span aria-hidden="true" className="emoji text-[14px] leading-none">{cat.emoji}</span>
                  <span>{cat.short}</span>
                  {item.status !== "new" && item.status !== "read" && (
                    <span className="ml-auto"><StatusBadge label={PUBLIC_STATUS_LABELS[item.status]} status={item.status} /></span>
                  )}
                </div>
                <ExpandableText lines={4} text={item.text} />
                {item.reply && (
                  <p className="text-[12px] text-stone-700 leading-snug whitespace-pre-line break-words pl-2.5 border-l-2" style={{ borderColor: item.status === "done" ? "rgba(21,128,61,0.45)" : "rgba(26,18,8,0.2)" }}>
                    <span className="font-semibold">Odpověď: </span>{item.reply}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-0.5">
                  <time className="text-[11px] text-stone-400 flex-1" dateTime={item.createdAt.replace(" ", "T")}>
                    {formatFeedbackDate(item.createdAt)}
                  </time>
                  {!itemOpen ? (
                    (t.up > 0 || t.down > 0) && (
                      <span className="text-[11px] text-stone-400 tabular-nums" aria-label={`Hlasy: ${t.up} pro, ${t.down} proti`}>
                        👍 {t.up} · 👎 {t.down}
                      </span>
                    )
                  ) : own ? (
                    <span className="text-[11px] font-semibold text-stone-400">Tvoje</span>
                  ) : (
                    <VoteButtons
                      compact
                      label={item.text.slice(0, 60)}
                      mine={mine[item.id]}
                      onVote={(v) => void vote(item.id, v)}
                      tally={t}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.length > limit && (
        <button
          className="w-full flex items-center justify-center gap-1 px-4 py-2.5 border-t border-white/50 text-[12px] font-semibold text-stone-500 hover:bg-white/40 transition"
          onClick={() => setLimit((l) => l + PAGE)}
          type="button"
        >
          Další ({list.length - limit})
          <MIcon name="expand_more" size={16} />
        </button>
      )}
      {error && <p className="px-4 pb-3 text-[11.5px] text-red-600" role="alert">{error}</p>}
    </section>
  );
}
