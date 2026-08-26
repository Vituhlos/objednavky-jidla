"use client";

import { useEffect, useState, useTransition } from "react";
import {
  actionListSessions,
  actionRevokeOtherSessions,
  type SessionView,
} from "@/app/actions-auth";
import { formatCzechDateTime } from "@/lib/format";
import MIcon from "../MIcon";

/**
 * Přihlášená zařízení.
 *
 * Smysl není v tom, aby si tu člověk hrál — je to odpověď na otázku „nezůstal
 * jsem někde přihlášený?“. Proto stačí jedno tlačítko, které to vyřeší.
 */
export function SessionList() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    actionListSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleRevoke = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const { count } = await actionRevokeOtherSessions();
        setSessions(await actionListSessions());
        setNote(
          count === 0
            ? "Nikde jinde jste přihlášení nebyli."
            : count === 1
              ? "Jedno zařízení odhlášeno."
              : `Odhlášeno ${count} zařízení.`
        );
      } catch {
        setNote("Odhlášení se nepodařilo.");
      }
    });
  };

  const jinde = sessions.filter((s) => !s.current).length;

  return (
    <div className="glass rounded-3xl p-5 flex flex-col gap-3">
      <p className="font-display font-bold text-[14px] text-stone-900">Přihlášená zařízení</p>

      {!loaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sessions.map((s) => (
            <li
              className="flex items-center gap-2.5 py-1.5 border-b border-white/50 last:border-0"
              key={s.id}
            >
              <MIcon
                name={s.current ? "smartphone" : "devices"}
                size={16}
                style={{ color: s.current ? "#D97706" : "#94a3b8", flexShrink: 0 }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-stone-800">
                  {s.device}{" "}
                  {s.current && (
                    <span className="ml-1.5 text-[11px] font-semibold text-amber-700">
                      toto zařízení
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-stone-400">
                  naposledy {formatCzechDateTime(s.lastSeenAt)}
                  {s.persistent && " · zůstat přihlášen"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p className="text-[12px] text-stone-600" role="status">
          {note}
        </p>
      )}

      <button
        className="modal-btn modal-btn--secondary w-full"
        disabled={isPending || jinde === 0}
        onClick={handleRevoke}
        type="button"
      >
        {isPending ? "Odhlašuji…" : "Odhlásit ostatní zařízení"}
      </button>
    </div>
  );
}
