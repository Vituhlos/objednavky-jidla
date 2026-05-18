"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import TenantAuthShell from "@/app/components/TenantAuthShell";

export default function TenantLoginPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/t/${tenantSlug}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Přihlášení se nezdařilo."); return; }
      router.push(`/t/${tenantSlug}`);
      router.refresh();
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantAuthShell>
      <div className="glass rounded-3xl p-7 scale-in">
        <h1 className="font-display font-extrabold text-[20px] text-slate-900 leading-none mb-1">Přihlásit se</h1>
        <p className="text-[12.5px] text-slate-500 mb-5">Zadejte své přihlašovací údaje</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">E-mail</span>
            <div className="relative">
              <MIcon name="mail" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="jmeno@firma.cz"
                className="k-field" style={{ paddingLeft: 38 }}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Heslo</span>
            <div className="relative">
              <MIcon name="lock" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPwd ? "text" : "password"} required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-rose-800"
              style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)" }}>
              <MIcon name="error" size={14} style={{ color: "#dc2626" }} />
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full mt-1 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold font-display px-4 py-2.5 rounded-2xl text-white transition disabled:opacity-55"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 12px 26px -10px rgba(234,88,12,0.55), 0 1px 0 rgba(255,255,255,0.35) inset",
            }}
          >
            <MIcon name="login" size={16} fill />
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>

        <div className="flex items-center justify-between mt-5 text-[11.5px]">
          <Link href={`/t/${tenantSlug}/zapomenute-heslo`} className="text-slate-500 hover:text-amber-700 font-semibold no-underline">
            Zapomněl jsem heslo
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/t/${tenantSlug}/register`} className="text-amber-700 hover:text-amber-900 font-semibold no-underline">
            Nemám účet → Vytvořit účet
          </Link>
        </div>
      </div>
    </TenantAuthShell>
  );
}
