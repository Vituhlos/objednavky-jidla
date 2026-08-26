"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { actionCheckPin } from "@/app/actions";
import MIcon from "../MIcon";

/**
 * Step-up potvrzení PINem nad již přihlášeným správcem. Syrový PIN smí vidět
 * jen rate-limitovaná server action; rodič dostane pouze zprávu, že server
 * vystavil HttpOnly doklad.
 *
 * Po několika chybných pokusech vrátí server `lockedUntil` a zámek odpočítává.
 * Zbývající čas žije ve stavu a osvěžuje ho interval; čtení hodin při renderu
 * by z komponenty udělalo nečistou funkci.
 */
export function PinGate({
  notice,
  onUnlock,
}: {
  notice?: string | null;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeftMs, setLockLeftMs] = useState(0);
  const [isPending, startTransition] = useTransition();
  const pinInputRef = useRef<HTMLInputElement>(null);
  const feedbackId = useId();
  const noticeId = useId();

  useEffect(() => {
    const t = setTimeout(() => pinInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // Re-render once a second while locked; the label itself is derived below, so the
  // effect only nudges the clock instead of storing formatted text in state.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const left = lockedUntil - Date.now();
      if (left <= 0) { setLockedUntil(null); setLockLeftMs(0); }
      else setLockLeftMs(left);
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = !!lockedUntil && lockLeftMs > 0;
  const lockLeft = isLocked
    ? `${Math.floor(Math.ceil(lockLeftMs / 1000) / 60)}:${String(Math.ceil(lockLeftMs / 1000) % 60).padStart(2, "0")}`
    : "";

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    startTransition(async () => {
      try {
        const res = await actionCheckPin(pin);
        if (res.ok) {
          setLockedUntil(null);
          // PIN už není k ničemu — oprávnění drží HttpOnly doklad ze serveru.
          // Nedržet ho ve stavu je laciné a odstraňuje to celý druh chyby.
          setPin("");
          onUnlock();
          return;
        }
        setPin("");
        if (res.lockedUntil) {
          setLockedUntil(res.lockedUntil);
          setLockLeftMs(Math.max(0, res.lockedUntil - Date.now()));
          setPinError(null);
        } else {
          setPinError("Nesprávný PIN. Zkuste to znovu.");
        }
      } catch {
        setPin("");
        setPinError("Ověření se nepodařilo. Obnovte stránku a přihlaste se znovu.");
      }
    });
  };

  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}>
          <MIcon name="lock" size={28} fill style={{ color: "#EA580C" }} />
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">Přístup chráněn PINem</p>
          <p className="text-[12.5px] text-stone-500 mt-1">Potvrďte správcovský PIN. Platnost je 30 minut.</p>
        </div>
        {notice && (
          <p className="text-[12px] text-amber-700 text-center -mt-1" id={noticeId} role="status">
            {notice}
          </p>
        )}
        <form className="w-full flex flex-col gap-3" onSubmit={handlePinSubmit}>
          <label className="sr-only" htmlFor="settings-pin">Správcovský PIN</label>
          <input
            aria-describedby={[notice ? noticeId : "", pinError || isLocked ? feedbackId : ""].filter(Boolean).join(" ") || undefined}
            aria-invalid={pinError ? true : undefined}
            autoComplete="current-password"
            className="modal-input text-center font-display font-bold"
            disabled={isLocked || isPending}
            id="settings-pin"
            maxLength={128}
            onChange={(e) => {
              setPin(e.target.value);
              setPinError(null);
            }}
            ref={pinInputRef}
            style={{ fontSize: "18px" }}
            type="password"
            value={pin}
          />
          {pinError && !isLocked && (
            <p className="text-[12px] text-red-500 text-center -mt-1" id={feedbackId} role="alert">
              {pinError}
            </p>
          )}
          {isLocked && (
            <p className="text-[12px] text-amber-700 text-center -mt-1" id={feedbackId} role="alert">
              Moc pokusů po sobě. Zkuste to znovu za <b className="tabular-nums">{lockLeft}</b>.
            </p>
          )}
          <button
            className="modal-btn modal-btn--primary w-full"
            disabled={isPending || pin.length === 0 || isLocked}
            type="submit"
          >
            {isPending ? "Ověřuji…" : "Odemknout"}
          </button>
        </form>
      </div>
    </div>
  );
}
