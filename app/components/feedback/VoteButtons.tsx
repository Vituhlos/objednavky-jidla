"use client";

import { useState } from "react";
import type { Tally } from "./useVotes";

/** Dvojice 👍 / 👎 s počty. Stejná tlačítka v „Co chystáme“ i v „Připomínkách ostatních“. */
export function VoteButtons({
  label,
  tally,
  mine,
  onVote,
  compact = false,
}: {
  /** Pro čtečku obrazovky — o čem se hlasuje. */
  label: string;
  tally: Tally;
  mine: 1 | -1 | undefined;
  onVote: (pressed: 1 | -1) => void;
  /** Menší palce pro lístky na nástěnce. */
  compact?: boolean;
}) {
  // Který palec se má právě „cvrnknout“ — jen po kliknutí, ne při načtení stránky
  const [pop, setPop] = useState<1 | -1 | null>(null);

  const press = (value: 1 | -1) => {
    // Animace jen při přidání hlasu; vzetí zpět je tiché
    setPop(mine === value ? null : value);
    onVote(value);
  };

  const button = (value: 1 | -1, emoji: string, count: number, name: string) => {
    const on = mine === value;
    return (
      <button
        aria-label={`${name}, zatím ${count}`}
        aria-pressed={on}
        className={`fb-vote${compact ? " fb-vote--sm" : ""}${on ? (value === 1 ? " fb-vote--on" : " fb-vote--down") : ""}`}
        onClick={() => press(value)}
        title={on ? "Vzít hlas zpět" : name}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`fb-vote__thumb emoji ${compact ? "text-[12.5px]" : "text-[14px]"} leading-none${pop === value ? " fb-vote__thumb--pop" : ""}`}
          onAnimationEnd={() => setPop(null)}
        >
          {emoji}
        </span>
        {/* key: nové číslo = nový prvek, takže krátce přijede zespodu */}
        <span key={count} className="fb-vote__count tabular-nums">{count}</span>
      </button>
    );
  };

  return (
    <div className={`flex items-center shrink-0 ${compact ? "gap-1" : "gap-1.5"}`} role="group" aria-label={`Hlasování: ${label}`}>
      {button(1, "👍", tally.up, "Palec nahoru")}
      {button(-1, "👎", tally.down, "Palec dolů")}
    </div>
  );
}
