"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionLogin } from "@/app/actions-auth";
import MIcon from "../MIcon";

/**
 * Přihlášení heslem.
 *
 * Po chybě zůstává vyplněný e-mail, heslo nikdy — kdo se překlepl v heslu, chce
 * psát znovu, kdo se překlepl v e-mailu, chce opravit. Chyba je jedna a tatáž
 * pro špatné heslo i neznámý účet; rozlišit je by znamenalo dát návod, které
 * e-maily tu účet mají.
 */
export function LoginForm({ googleEnabled, next }: { googleEnabled: boolean; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return; // pojistka proti dvojímu odeslání
    setError(null);

    startTransition(async () => {
      const res = await actionLogin(email, password, stayLoggedIn);
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setPassword("");
      setError(res.error);
    });
  };

  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
        >
          <MIcon name="login" size={28} fill style={{ color: "#EA580C" }} />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">Vítejte zpátky</p>
          <p className="text-[12.5px] text-stone-500 mt-1">
            Objednávat můžete po přihlášení. Jídelníček a objednávky jsou vidět i bez něj.
          </p>
        </div>

        <form className="w-full flex flex-col gap-3" noValidate onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="login-email">
              E-mail
            </label>
            <input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="email"
              className={`modal-input${error ? " modal-input--error" : ""}`}
              disabled={isPending}
              id="login-email"
              onChange={(e) => setEmail(e.target.value)}
              ref={emailRef}
              type="email"
              value={email}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="login-password">
              Heslo
            </label>
            <input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              className={`modal-input${error ? " modal-input--error" : ""}`}
              disabled={isPending}
              id="login-password"
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-stone-600 select-none">
            <input
              checked={stayLoggedIn}
              className="accent-amber-600 w-4 h-4"
              disabled={isPending}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              type="checkbox"
            />
            Zůstat přihlášen
          </label>

          {error && (
            <p className="text-[12px] text-red-500 text-center -mt-1" id={errorId} role="alert">
              {error}
            </p>
          )}

          <button
            className="modal-btn modal-btn--primary w-full"
            disabled={isPending || !email.trim() || !password}
            type="submit"
          >
            {isPending ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div aria-hidden="true" className="w-full flex items-center gap-2">
              <span className="flex-1 h-px bg-stone-200" />
              <span className="text-[11px] text-stone-400">nebo</span>
              <span className="flex-1 h-px bg-stone-200" />
            </div>
            <a
              className="modal-btn modal-btn--secondary w-full flex items-center justify-center gap-2"
              href="/api/auth/google/start"
            >
              <MIcon name="account_circle" size={17} />
              Přihlásit se Googlem
            </a>
          </>
        )}

        <p className="text-[12px] text-stone-500 text-center">
          <a className="underline" href="/ucet/zapomenute-heslo">Zapomenělé heslo?</a>
        </p>

        <p className="text-[12px] text-stone-500 text-center">
          Nemáte účet?{" "}
          <a className="font-semibold underline" href="/ucet/registrace">
            Zaregistrujte se
          </a>
        </p>
      </div>
    </div>
  );
}
