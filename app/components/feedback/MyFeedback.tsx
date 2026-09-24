"use client";

import { useState } from "react";
import { getCategoryMeta, PUBLIC_STATUS_LABELS, WITHDRAWABLE_STATUSES, type OwnFeedback } from "@/lib/feedback-meta";
import MIcon from "../MIcon";
import { formatFeedbackDate } from "./feedback-utils";
import { StatusBadge } from "./StatusBadge";


/**
 * Připomínky odeslané z tohoto prohlížeče: vlastní text, stav a odpověď správce.
 * Karta se ukáže, až když nějaká je — prázdná by jen zabírala místo.
 *
 * Křížek u otevřené připomínky ji po potvrzení opravdu stáhne (zmizí i u
 * ostatních). U vyřízené jen skryje z vlastního seznamu — ta patří do historie.
 */
export function MyFeedback({
  items,
  updates,
  onForget,
  onWithdraw,
}: {
  items: OwnFeedback[];
  updates: Map<number, "reply" | "status">;
  onForget: (id: number) => void;
  onWithdraw: (id: number) => Promise<string | null>;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ id: number; text: string } | null>(null);

  if (items.length === 0) return null;

  const withdraw = async (id: number) => {
    setBusy(true);
    setError(null);
    const problem = await onWithdraw(id);
    setBusy(false);
    if (problem) setError({ id, text: problem });
    else setConfirmId(null);
  };

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
          const canWithdraw = WITHDRAWABLE_STATUSES.includes(item.status);
          const label = canWithdraw ? "Stáhnout připomínku" : "Skrýt z mého seznamu";
          return (
            <li key={item.id} className={`group px-4 py-3 flex flex-col gap-1.5${updates.has(item.id) ? " fb-own--updated" : ""}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="emoji text-[15px] leading-none">{cat.emoji}</span>
                <StatusBadge label={PUBLIC_STATUS_LABELS[item.status]} status={item.status} />
                {updates.has(item.id) && (
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
                    {updates.get(item.id) === "reply" ? "Nová odpověď" : "Nový stav"}
                  </span>
                )}
                <span className="text-[11px] text-stone-400 ml-auto">{formatFeedbackDate(item.createdAt)}</span>
                <button
                  aria-label={label}
                  className="w-6 h-6 -mr-1 rounded-full inline-flex items-center justify-center text-stone-300 hover:text-stone-500 hover:bg-black/5 transition"
                  onClick={() => (canWithdraw ? setConfirmId(item.id) : onForget(item.id))}
                  title={label}
                  type="button"
                >
                  <MIcon name="close" size={13} />
                </button>
              </div>
              <p className="text-[12.5px] text-stone-700 leading-snug line-clamp-2 break-words">{item.message}</p>
              {item.merged && (
                <p className="text-[11px] text-stone-400">Sloučeno s podobnou připomínkou — stav i odpověď jsou společné.</p>
              )}
              {item.reply && (
                <p className="text-[12.5px] text-stone-800 leading-snug whitespace-pre-line break-words pl-2.5 border-l-2" style={{ borderColor: "rgba(234,88,12,0.45)" }}>
                  <span className="font-semibold">Odpověď: </span>{item.reply}
                </p>
              )}
              {confirmId === item.id && (
                <div className="flex items-center gap-2 mt-0.5 pl-3 pr-1.5 py-1.5 rounded-xl fade-up" role="alert"
                  style={{ background: "rgba(26,18,8,0.04)", border: "1px solid rgba(26,18,8,0.07)" }}>
                  <span className="text-[12px] text-stone-600 flex-1 min-w-0">Stáhnout? Zmizí i u ostatních.</span>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <button className="text-[12px] font-semibold px-2.5 py-1.5 text-stone-500" onClick={() => { setConfirmId(null); setError(null); }} type="button">
                      Nechat
                    </button>
                    <button
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-xl text-red-600 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void withdraw(item.id)}
                      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}
                      type="button"
                    >
                      {busy ? "Stahuji…" : "Stáhnout"}
                    </button>
                  </div>
                </div>
              )}
              {error?.id === item.id && <p className="text-[11.5px] text-red-600">{error.text}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
