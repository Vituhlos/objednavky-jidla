"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  actionCreateInvite,
  actionGuestCount,
  actionListInvites,
  actionRevokeInvite,
  type InviteView,
} from "@/app/actions-auth";
import { formatCzechDateTime } from "@/lib/format";
import MIcon from "../MIcon";

const MAX_HOSTU = 3;

/**
 * Pozvánky pro hosty.
 *
 * Host je rodinný příslušník, který si chce objednávat sám. Odkaz je zároveň
 * oprávnění i doklad, kdo za něj ručí — bez něj by se hostem prohlásil kdokoli.
 *
 * Odkaz se ukáže **jedinkrát**. V databázi je jen otisk, takže ho potom
 * nezjistí ani správce; kdo ho ztratí, vytvoří nový a starý zruší.
 */
export function InviteSection() {
  const [invites, setInvites] = useState<InviteView[]>([]);
  const [guests, setGuests] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();
  const linkId = useId();

  const reload = async () => {
    const [list, count] = await Promise.all([actionListInvites(), actionGuestCount()]);
    setInvites(list);
    setGuests(count);
  };

  useEffect(() => {
    Promise.all([actionListInvites(), actionGuestCount()])
      .then(([list, count]) => {
        setInvites(list);
        setGuests(count);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const cekajici = invites.filter((i) => !i.used && !i.revoked).length;

  const handleCreate = () => {
    if (isPending) return;
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await actionCreateInvite();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFresh({ url: res.url, expiresAt: res.expiresAt });
      await reload();
    });
  };

  const handleRevoke = (id: number) => {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await actionRevokeInvite(id);
      if (!res.ok) setError(res.error);
      await reload();
    });
  };

  return (
    <div className="glass rounded-3xl p-5 flex flex-col gap-3">
      <div>
        <p className="font-display font-bold text-[14px] text-stone-900">Hosté</p>
        <p className="text-[12px] text-stone-500 mt-0.5">
          Pozvěte rodinu, ať si objedná sama. Za hosta ručíte vy. Nejvýš {MAX_HOSTU} hosté,
          host už dál zvát nemůže.
        </p>
      </div>

      {loaded && (
        <p className="text-[12px] text-stone-600">
          Aktivní hosté: <b>{guests}</b> z {MAX_HOSTU} · čekající pozvánky: <b>{cekajici}</b> z 5
        </p>
      )}

      {fresh && (
        <div
          className="rounded-2xl p-3 flex flex-col gap-2"
          style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}
        >
          <p className="text-[12px] text-stone-700">
            Pošlete tenhle odkaz hostovi. <b>Uvidíte ho jen teď</b> — v databázi
            zůstává jen otisk. Platí do {formatCzechDateTime(fresh.expiresAt)}.
          </p>
          <label className="sr-only" htmlFor={linkId}>
            Pozvací odkaz
          </label>
          <input
            className="modal-input text-[12px]"
            id={linkId}
            onFocus={(e) => e.currentTarget.select()}
            readOnly
            value={fresh.url}
          />
          <button
            className="modal-btn modal-btn--secondary"
            onClick={() => {
              navigator.clipboard?.writeText(fresh.url).then(
                () => setCopied(true),
                () => setCopied(false)
              );
            }}
            type="button"
          >
            {copied ? "Zkopírováno ✓" : "Zkopírovat odkaz"}
          </button>
          <p aria-live="polite" className="sr-only">
            {copied ? "Odkaz zkopírován do schránky." : ""}
          </p>
        </div>
      )}

      {invites.length > 0 && (
        <ul className="flex flex-col gap-1">
          {invites.map((i) => {
            const stav = i.used
              ? "uplatněná"
              : i.revoked
                ? "zrušená"
                : new Date(i.expiresAt) < new Date()
                  ? "prošlá"
                  : "čeká";
            return (
              <li
                className="flex items-center gap-2 py-1.5 border-b border-white/50 last:border-0"
                key={i.id}
              >
                <MIcon
                  name={i.used ? "how_to_reg" : i.revoked ? "block" : "schedule"}
                  size={15}
                  style={{ color: i.used ? "#4f6f52" : "#94a3b8", flexShrink: 0 }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] text-stone-700">Pozvánka {stav}</span>
                  <span className="block text-[11px] text-stone-400">
                    vytvořena {formatCzechDateTime(i.createdAt)}
                  </span>
                </span>
                {stav === "čeká" && (
                  <button
                    aria-label={`Zrušit pozvánku vytvořenou ${formatCzechDateTime(i.createdAt)}`}
                    className="modal-btn modal-btn--secondary shrink-0"
                    disabled={isPending}
                    onClick={() => handleRevoke(i.id)}
                    type="button"
                  >
                    Zrušit
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="text-[12px] text-red-500" id={errorId} role="alert">
          {error}
        </p>
      )}

      <button
        className="modal-btn modal-btn--primary w-full"
        disabled={isPending || !loaded}
        onClick={handleCreate}
        type="button"
      >
        {isPending ? "Vytvářím…" : "Vytvořit pozvánku"}
      </button>
    </div>
  );
}
