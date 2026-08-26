"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionRegisterGuest } from "@/app/actions-auth";
import MIcon from "../MIcon";

const MIN_HESLO = 12;

/**
 * Registrace hosta.
 *
 * Proti běžné registraci chybí krok „nejsi to náhodou ty?“ — host historii
 * nepřebírá, host je nový člověk. Vazbu na pozvatele i spotřebování pozvánky
 * řeší jediná backendová transakce, takže odsud jde jen to, co host vyplnil.
 */
export function GuestRegisterForm({
  departments,
  inviterName,
  token,
}: {
  departments: { id: number; label: string }[];
  inviterName: string;
  token: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();
  const hintId = useId();

  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
        >
          <MIcon name="group_add" size={28} fill style={{ color: "#EA580C" }} />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">
            Pozvánka od {inviterName}
          </p>
          <p className="text-[12.5px] text-stone-500 mt-1">
            Založte si účet a objednávejte si sami. {inviterName} za vás ručí.
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
              const res = await actionRegisterGuest(
                token,
                email,
                name,
                password,
                departmentId ? Number(departmentId) : null
              );
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
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="guest-name">
              Jméno a příjmení
            </label>
            <input
              autoComplete="name"
              className="modal-input"
              disabled={isPending}
              id="guest-name"
              onChange={(e) => setName(e.target.value)}
              type="text"
              value={name}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="guest-dept">
              Oddělení
            </label>
            <select
              className="k-select"
              disabled={isPending}
              id="guest-dept"
              onChange={(e) => setDepartmentId(e.target.value)}
              value={departmentId}
            >
              <option value="">— vyberte —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-400">Nejspíš to, ve kterém je {inviterName}.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="guest-email">
              E-mail
            </label>
            <input
              autoComplete="email"
              className="modal-input"
              disabled={isPending}
              id="guest-email"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="guest-password">
              Heslo
            </label>
            <input
              aria-describedby={hintId}
              autoComplete="new-password"
              className="modal-input"
              disabled={isPending}
              id="guest-password"
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
            <p className="text-[11px] text-stone-400" id={hintId}>
              Nejméně {MIN_HESLO} znaků.
            </p>
          </div>

          {error && (
            <p className="text-[12px] text-red-500 text-center -mt-1" id={errorId} role="alert">
              {error}
            </p>
          )}

          <button
            className="modal-btn modal-btn--primary w-full"
            disabled={
              isPending ||
              !email.trim() ||
              name.trim().length < 2 ||
              password.length < MIN_HESLO ||
              !departmentId
            }
            type="submit"
          >
            {isPending ? "Zakládám…" : "Založit účet hosta"}
          </button>
        </form>
      </div>
    </div>
  );
}
