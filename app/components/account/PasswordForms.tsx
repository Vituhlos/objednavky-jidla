"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionChangePassword,
  actionRequestPasswordReset,
  actionResetPassword,
} from "@/app/actions-auth";
import MIcon from "../MIcon";

const MIN_HESLO = 12;

function Karta({
  children,
  icon,
  text,
  title,
}: {
  children: React.ReactNode;
  icon: string;
  text: string;
  title: string;
}) {
  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
        >
          <MIcon name={icon} size={28} fill style={{ color: "#EA580C" }} />
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">{title}</p>
          <p className="text-[12.5px] text-stone-500 mt-1">{text}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Žádost o odkaz na obnovu hesla.
 *
 * Po odeslání se vždy ukáže totéž, i když účet neexistuje. Kdyby appka
 * rozlišovala, stal by se z formuláře nástroj na zjišťování, kdo tu účet má.
 */
export function ForgottenPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();

  if (sent) {
    return (
      <Karta
        icon="mark_email_read"
        text="Pokud pod touhle adresou účet existuje, odkaz na obnovu je na cestě. Platí patnáct minut."
        title="Zkontrolujte poštu"
      >
        <a className="modal-btn modal-btn--secondary w-full text-center" href="/ucet/prihlaseni">
          Zpět na přihlášení
        </a>
      </Karta>
    );
  }

  return (
    <Karta
      icon="lock_reset"
      text="Pošleme vám odkaz, kterým si nastavíte nové heslo."
      title="Zapomenuté heslo"
    >
      <form
        className="w-full flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isPending) return;
          setError(null);
          startTransition(async () => {
            const res = await actionRequestPasswordReset(email);
            if (res.ok) setSent(true);
            else setError(res.error);
          });
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold text-stone-600" htmlFor="forgot-email">
            E-mail
          </label>
          <input
            aria-describedby={error ? errorId : undefined}
            autoComplete="email"
            className={`modal-input${error ? " modal-input--error" : ""}`}
            disabled={isPending}
            id="forgot-email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
        </div>

        {error && (
          <p className="text-[12px] text-red-500 text-center" id={errorId} role="alert">
            {error}
          </p>
        )}

        <button
          className="modal-btn modal-btn--primary w-full"
          disabled={isPending || !email.trim()}
          type="submit"
        >
          {isPending ? "Odesílám…" : "Poslat odkaz"}
        </button>
      </form>
    </Karta>
  );
}

/** Nastavení nového hesla z odkazu. Token drží stránka, do klienta nejde. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();
  const hintId = useId();

  const neshoda = again.length > 0 && password !== again;

  if (done) {
    return (
      <Karta
        icon="check_circle"
        text="Heslo je nastavené. Ostatní zařízení jsme pro jistotu odhlásili."
        title="Hotovo"
      >
        <button
          className="modal-btn modal-btn--primary w-full"
          onClick={() => {
            router.replace("/ucet/prihlaseni");
            router.refresh();
          }}
          type="button"
        >
          Přihlásit se
        </button>
      </Karta>
    );
  }

  return (
    <Karta icon="lock_reset" text={`Nejméně ${MIN_HESLO} znaků.`} title="Nové heslo">
      <form
        className="w-full flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isPending || neshoda) return;
          setError(null);
          startTransition(async () => {
            const res = await actionResetPassword(token, password);
            if (res.ok) setDone(true);
            else {
              setPassword("");
              setAgain("");
              setError(res.error);
            }
          });
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold text-stone-600" htmlFor="reset-password">
            Nové heslo
          </label>
          <input
            aria-describedby={hintId}
            autoComplete="new-password"
            className="modal-input"
            disabled={isPending}
            id="reset-password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
          <p className="text-[11px] text-stone-400" id={hintId}>
            Delší je lepší než složitější — klidně krátká věta.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-semibold text-stone-600" htmlFor="reset-again">
            Heslo znovu
          </label>
          <input
            aria-invalid={neshoda ? true : undefined}
            autoComplete="new-password"
            className={`modal-input${neshoda ? " modal-input--error" : ""}`}
            disabled={isPending}
            id="reset-again"
            onChange={(e) => setAgain(e.target.value)}
            type="password"
            value={again}
          />
          {neshoda && (
            <p className="text-[11px] text-red-500" role="alert">
              Hesla se neshodují.
            </p>
          )}
        </div>

        {error && (
          <p className="text-[12px] text-red-500 text-center" id={errorId} role="alert">
            {error}
          </p>
        )}

        <button
          className="modal-btn modal-btn--primary w-full"
          disabled={isPending || password.length < MIN_HESLO || neshoda || !again}
          type="submit"
        >
          {isPending ? "Ukládám…" : "Nastavit heslo"}
        </button>
      </form>
    </Karta>
  );
}

/** Změna hesla zevnitř účtu. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [stav, setStav] = useState<"idle" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (isPending) return;
        setError(null);
        startTransition(async () => {
          const res = await actionChangePassword(current, next);
          setCurrent("");
          setNext("");
          if (res.ok) setStav("done");
          else setError(res.error);
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-semibold text-stone-600" htmlFor="pw-current">
          Stávající heslo
        </label>
        <input
          autoComplete="current-password"
          className="modal-input"
          disabled={isPending}
          id="pw-current"
          onChange={(e) => setCurrent(e.target.value)}
          type="password"
          value={current}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-semibold text-stone-600" htmlFor="pw-next">
          Nové heslo
        </label>
        <input
          autoComplete="new-password"
          className="modal-input"
          disabled={isPending}
          id="pw-next"
          onChange={(e) => setNext(e.target.value)}
          type="password"
          value={next}
        />
      </div>

      {error && (
        <p className="text-[12px] text-red-500" id={errorId} role="alert">
          {error}
        </p>
      )}
      {stav === "done" && !error && (
        <p className="text-[12px] text-green-700" role="status">
          Heslo je změněné. Ostatní zařízení jsme odhlásili.
        </p>
      )}

      <button
        className="modal-btn modal-btn--secondary w-full"
        disabled={isPending || !current || next.length < MIN_HESLO}
        type="submit"
      >
        {isPending ? "Ukládám…" : "Změnit heslo"}
      </button>
    </form>
  );
}
