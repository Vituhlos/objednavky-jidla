"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import TenantAuthShell from "@/app/components/TenantAuthShell";

export default function TenantForgotPasswordPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetch(`/t/${tenantSlug}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantAuthShell>
      <div className="glass rounded-3xl p-7 scale-in">
        <h1 className="font-display font-extrabold text-[20px] text-slate-900 leading-none mb-1">Zapomenuté heslo</h1>
        <p className="text-[12.5px] text-slate-500 mb-5">
          Zadejte e-mail a pošleme vám odkaz pro obnovení hesla.
        </p>

        {sent ? (
          <div
            className="rounded-2xl px-4 py-4 flex items-start gap-3"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}
          >
            <MIcon name="mark_email_read" size={20} fill style={{ color: "#059669" }} />
            <div className="text-[12.5px] text-emerald-800 leading-snug">
              <strong className="block">Hotovo!</strong>
              Pokud k <strong className="font-semibold">{email}</strong> existuje účet, dorazí během pár minut e-mail s odkazem.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">E-mail</span>
              <div className="relative">
                <MIcon name="mail" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email" required autoFocus autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jmeno@firma.cz"
                  className="k-field" style={{ paddingLeft: 38 }}
                />
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
              <MIcon name="send" size={16} fill />
              {loading ? "Odesílám…" : "Odeslat odkaz"}
            </button>
          </form>
        )}

        <div className="text-center mt-5">
          <Link
            href={`/t/${tenantSlug}/login`}
            className="text-[11.5px] text-slate-500 hover:text-amber-700 font-semibold inline-flex items-center gap-1 no-underline"
          >
            <MIcon name="arrow_back" size={12} /> Zpět na přihlášení
          </Link>
        </div>
      </div>
    </TenantAuthShell>
  );
}
