"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { actionCheckPin } from "@/app/actions";
import MIcon from "../MIcon";

/**
 * Zámek nastavení. Po správném PINu předá zadanou hodnotu nahoru — server ji
 * u každého uložení chce znovu, takže si ji koordinátor drží po dobu relace.
 *
 * Po několika chybných pokusech vrátí server `lockedUntil` a zámek odpočítává.
 * Zbývající čas žije ve stavu a osvěžuje ho interval; čtení hodin při renderu
 * by z komponenty udělalo nečistou funkci.
 */
export function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeftMs, setLockLeftMs] = useState(0);
  const [isPending, startTransition] = useTransition();
  const pinInputRef = useRef<HTMLInputElement>(null);

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
    setPinError(false);
    startTransition(async () => {
      const res = await actionCheckPin(pin);
      if (res.ok) {
        setLockedUntil(null);
        onUnlock(pin);
        return;
      }
      setPin("");
      if (res.lockedUntil) {
        setLockedUntil(res.lockedUntil);
        setLockLeftMs(Math.max(0, res.lockedUntil - Date.now()));
        setPinError(false);
      }
      else setPinError(true);
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
        <form className="w-full flex flex-col gap-3" onSubmit={handlePinSubmit}>
          <label className="sr-only" htmlFor="settings-pin">Správcovský PIN</label>
          <input
            aria-invalid={pinError ? true : undefined}
            autoComplete="current-password"
            className="modal-input text-center font-display font-bold"
            disabled={isLocked || isPending}
            id="settings-pin"
            maxLength={128}
            onChange={(e) => setPin(e.target.value)}
            ref={pinInputRef}
            style={{ fontSize: "18px" }}
            type="password"
            value={pin}
          />
          {pinError && !isLocked && (
            <p className="text-[12px] text-red-500 text-center -mt-1" role="alert">
              Nesprávný PIN. Zkuste to znovu.
            </p>
          )}
          {isLocked && (
            <p className="text-[12px] text-amber-700 text-center -mt-1" role="alert">
              Moc pokusů po sobě. Zkuste to znovu za <b className="tabular-nums">{lockLeft}</b>.
            </p>
          )}
          <button
            className="modal-btn modal-btn--primary w-full"
            disabled={isPending || pin.length === 0 || isLocked}
            type="submit"
          >
            {isPending ? "Ověřuji..." : "Odemknout"}
          </button>
        </form>
      </div>
    </div>
  );
}
