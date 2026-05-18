"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import TenantAuthShell from "@/app/components/TenantAuthShell";

function RegisterForm() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [joinCode] = useState(searchParams.get("code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) { setError("Hesla se neshodují."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/t/${tenantSlug}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, password, joinCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registrace se nezdařila."); return; }
      router.push(`/t/${tenantSlug}`);
      router.refresh();
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-7 scale-in">
      {joinCode && (
        <div
          className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
        >
          <MIcon name="check_circle" size={13} fill style={{ color: "#059669" }} />
          <span className="text-[11.5px] font-semibold text-emerald-700">Kód:</span>
          <span className="font-mono text-[11.5px] font-bold text-emerald-800 tracking-wide">{joinCode}</span>
        </div>
      )}

      <h1 className="font-display font-extrabold text-[20px] text-slate-900 leading-none mb-1">Vytvořit účet</h1>
      <p className="text-[12.5px] text-slate-500 mb-5">Připojte se do kantýny</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Jméno</span>
            <input
              type="text" required autoComplete="given-name"
              value={firstName} onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jan" className="k-field"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Příjmení</span>
            <input
              type="text" required autoComplete="family-name"
              value={lastName} onChange={(e) => setLastName(e.target.value)}
              placeholder="Novák" className="k-field"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">E-mail</span>
          <div className="relative">
            <MIcon name="mail" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="jan.novak@firma.cz"
              className="k-field" style={{ paddingLeft: 38 }}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Heslo</span>
          <div className="relative">
            <MIcon name="lock" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPwd ? "text" : "password"} required autoComplete="new-password" minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 znaků"
              className="k-field font-mono" style={{ paddingLeft: 38, paddingRight: 40 }}
            />
            <button
              type="button" tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Skrýt heslo" : "Zobrazit heslo"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <MIcon name={showPwd ? "visibility_off" : "visibility"} size={16} />
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Potvrdit heslo</span>
          <div className="relative">
            <MIcon name="lock" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPwd ? "text" : "password"} required autoComplete="new-password"
              value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              className="k-field font-mono"
              style={{ paddingLeft: 38, borderColor: passwordMismatch ? "rgba(239,68,68,0.45)" : undefined }}
            />
          </div>
          {passwordMismatch && (
            <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
              <MIcon name="error" size={12} /> Hesla se neshodují
            </div>
          )}
        </label>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-rose-800"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)" }}>
            <MIcon name="error" size={14} style={{ color: "#dc2626" }} />
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading || passwordMismatch}
          className="w-full mt-1 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold font-display px-4 py-2.5 rounded-2xl text-white transition disabled:opacity-55"
          style={{
            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: "0 12px 26px -10px rgba(234,88,12,0.55), 0 1px 0 rgba(255,255,255,0.35) inset",
          }}
        >
          <MIcon name="how_to_reg" size={16} fill />
          {loading ? "Registruji…" : "Vytvořit účet"}
        </button>
      </form>

      <div className="text-center mt-5 text-[11.5px] text-slate-500">
        Už mám účet →{" "}
        <Link href={`/t/${tenantSlug}/login`} className="text-amber-700 font-semibold hover:text-amber-900 no-underline">
          Přihlásit se
        </Link>
      </div>
    </div>
  );
}

export default function TenantRegisterPage() {
  return (
    <TenantAuthShell>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </TenantAuthShell>
  );
}
