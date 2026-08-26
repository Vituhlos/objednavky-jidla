"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionRegister } from "@/app/actions-auth";
import MIcon from "../MIcon";

const MIN_HESLO = 12;

/**
 * Registrace heslem.
 *
 * Veřejná registrace vždy zakládá nového strávníka. Shodné jméno není důkaz
 * identity; případné sloučení dřívější historie proto smí udělat až správce.
 */
export function RegisterForm({
  departments,
}: {
  departments: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();
  const hintId = useId();

  const odeslat = () => {
    setError(null);
    startTransition(async () => {
      const res = await actionRegister(
        email,
        name,
        password,
        departmentId ? Number(departmentId) : null
      );
      if ("ok" in res && res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      if ("claim" in res) {
        // Kompatibilita se starším serverem nesmí znovu otevřít veřejné
        // přivlastnění historie. Uživatel nedostane veřejná interní ID.
        setPassword("");
        setError("Účet se nepodařilo založit. Obraťte se na správce.");
        return;
      }
      setPassword("");
      setError(res.error);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    odeslat();
  };

  return (
    <div className="glass rounded-3xl overflow-hidden max-w-sm mx-auto mt-8">
      <div className="flex flex-col items-center gap-4 p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(234,88,12,0.15))" }}
        >
          <MIcon name="person_add" size={28} fill style={{ color: "#EA580C" }} />
        </div>

        <div className="text-center">
          <p className="font-display font-bold text-[17px] text-stone-900">Nový účet</p>
          <p className="text-[12.5px] text-stone-500 mt-1">
            Stačí čtyři údaje. Nic dalšího k objednání oběda nepotřebujeme.
          </p>
        </div>

        <form className="w-full flex flex-col gap-3" noValidate onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="reg-name">
              Jméno a příjmení
            </label>
            <input
              autoComplete="name"
              className="modal-input"
              disabled={isPending}
              id="reg-name"
              onChange={(e) => setName(e.target.value)}
              type="text"
              value={name}
            />
            <p className="text-[11px] text-stone-400">
              Takhle se objevíte v objednávce i v PDF pro LIMA. Dřívější historii může případně sloučit správce.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="reg-dept">
              Oddělení
            </label>
            <select
              className="k-select"
              disabled={isPending}
              id="reg-dept"
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
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="reg-email">
              E-mail
            </label>
            <input
              autoComplete="email"
              className="modal-input"
              disabled={isPending}
              id="reg-email"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-stone-600" htmlFor="reg-password">
              Heslo
            </label>
            <input
              aria-describedby={hintId}
              autoComplete="new-password"
              className="modal-input"
              disabled={isPending}
              id="reg-password"
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
            <p className="text-[11px] text-stone-400" id={hintId}>
              Nejméně {MIN_HESLO} znaků. Delší je lepší než složitější — klidně krátká věta.
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
            {isPending ? "Zakládám…" : "Založit účet"}
          </button>
        </form>

        <p className="text-[12px] text-stone-500 text-center">
          Už účet máte?{" "}
          <a className="font-semibold underline" href="/ucet/prihlaseni">
            Přihlaste se
          </a>
        </p>
      </div>
    </div>
  );
}
