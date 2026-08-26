"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionConfirmGoogleLink } from "@/app/actions-auth";
import MIcon from "../MIcon";

/**
 * Potvrzení hesla při propojování Google účtu (R6).
 *
 * Formulář posílá **jen heslo**. E-mail i Google `subject` jsou v podepsané
 * cookie od serveru — kdyby se braly odsud, stačilo by poslat cizí adresu
 * a Google by si přivlastnil cizí účet.
 */
export function GoogleLinkForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
        >
          <MIcon name="link" size={28} fill style={{ color: "#EA580C" }} />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">Účet už existuje</p>
          <p className="text-[12.5px] text-stone-500 mt-1">
            Pod adresou <b>{email}</b> je účet s heslem. Zadejte ho a Google se k němu
            připojí — příště se přihlásíte jedním klikem.
          </p>
        </div>

        <form
          className="w-full flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (isPending) return;
            setError(null);
            startTransition(async () => {
              const res = await actionConfirmGoogleLink(password);
              if (res.ok) {
                router.replace("/");
                router.refresh();
                return;
              }
              setPassword("");
              setError(res.error);
            });
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="link-password">
              Heslo k účtu
            </label>
            <input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              className={`modal-input${error ? " modal-input--error" : ""}`}
              disabled={isPending}
              id="link-password"
              onChange={(e) => setPassword(e.target.value)}
              ref={inputRef}
              type="password"
              value={password}
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 text-center -mt-1" id={errorId} role="alert">
              {error}
            </p>
          )}

          <button
            className="modal-btn modal-btn--primary w-full"
            disabled={isPending || !password}
            type="submit"
          >
            {isPending ? "Propojuji…" : "Propojit a přihlásit"}
          </button>
        </form>

        <p className="text-[12px] text-stone-500 text-center">
          Nechcete propojovat?{" "}
          <a className="font-semibold underline" href="/ucet/prihlaseni">
            Přihlaste se heslem
          </a>
        </p>
      </div>
    </div>
  );
}
