"use client";

import { useState } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import type { DepartmentInfo } from "@/lib/departments";

interface Props {
  departments: Pick<DepartmentInfo, "name" | "label">[];
}

export default function RegistraceForm({ departments }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [defaultDepartment, setDefaultDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password, defaultDepartment: defaultDepartment || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Registrace selhala. Zkuste to znovu.");
        return;
      }
      setDone(true);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <MIcon name="mark_email_read" size={28} style={{ color: "#16a34a" }} />
          </div>
          <div>
            <p className="font-display font-bold text-[17px] text-stone-900">Zkontroluj e-mail</p>
            <p className="text-[13px] text-stone-500 mt-1.5 leading-relaxed max-w-xs">
              Odeslali jsme ověřovací odkaz na <strong className="text-stone-700">{email}</strong>.
              Klikni na něj a pak se přihlas.
            </p>
          </div>
          <Link href="/login" className="modal-btn modal-btn--primary w-full mt-1 text-center">
            Přejít na přihlášení
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <form onSubmit={handleSubmit} noValidate className="p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-firstname" className="text-[12px] font-semibold text-stone-600">Jméno</label>
            <input
              id="reg-firstname"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jan"
              className="modal-input"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-lastname" className="text-[12px] font-semibold text-stone-600">Příjmení</label>
            <input
              id="reg-lastname"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Novák"
              className="modal-input"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="reg-email" className="text-[12px] font-semibold text-stone-600">E-mail</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jmeno@firma.cz"
            className="modal-input"
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="reg-password" className="text-[12px] font-semibold text-stone-600">Heslo</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Alespoň 6 znaků"
              className="modal-input pr-9"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Skrýt heslo" : "Zobrazit heslo"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
              tabIndex={-1}
            >
              <MIcon name={showPass ? "visibility_off" : "visibility"} size={18} />
            </button>
          </div>
        </div>

        {departments.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-dept" className="text-[12px] font-semibold text-stone-600">
              Výchozí oddělení <span className="font-normal text-stone-400">(volitelné)</span>
            </label>
            <select
              id="reg-dept"
              value={defaultDepartment}
              onChange={(e) => setDefaultDepartment(e.target.value)}
              className="modal-select"
              disabled={loading}
            >
              <option value="">— Nevybráno —</option>
              {departments.map((d) => (
                <option key={d.name} value={d.name}>{d.label}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p role="alert" className="text-[12px] text-red-600 -mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="modal-btn modal-btn--primary w-full"
        >
          {loading ? "Registruji…" : "Vytvořit účet"}
        </button>
      </form>
    </div>
  );
}
