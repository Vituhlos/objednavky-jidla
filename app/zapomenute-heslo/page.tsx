"use client";

import { useState } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import PageHeader from "@/app/components/PageHeader";

export default function ZapomenuteHesloPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.status === 429) {
        setError(data.error ?? "Příliš mnoho pokusů. Zkuste to za chvíli.");
        return;
      }
      // Vždy zobrazíme úspěch — API neprozrazuje jestli účet existuje
      setDone(true);
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="k-shell">
      <PageHeader title="Zapomenuté heslo" mobileTitle="Zapomenuté heslo" />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav flex items-start justify-center">
        <div className="max-w-sm w-full flex flex-col gap-4 py-4">

          {done ? (
            <div className="glass-card rounded-3xl overflow-hidden">
              <div className="p-8 flex flex-col items-center gap-4 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
                >
                  <MIcon name="mail" size={28} style={{ color: "#16a34a" }} />
                </div>
                <div>
                  <p className="font-display font-bold text-[17px] text-stone-900">Zkontroluj e-mail</p>
                  <p className="text-[13px] text-stone-500 mt-1.5 leading-relaxed max-w-xs">
                    Pokud účet s adresou <strong className="text-stone-700">{email}</strong> existuje,
                    přišel ti odkaz pro reset hesla.
                  </p>
                </div>
                <Link href="/login" className="modal-btn modal-btn--secondary w-full mt-1 text-center">
                  Zpět na přihlášení
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1 mb-1">
                <p className="font-display font-bold text-[18px] text-stone-900">Zapomenuté heslo</p>
                <p className="text-[13px] text-stone-500 text-center">Pošleme ti odkaz pro reset hesla</p>
              </div>

              <div className="glass-card rounded-3xl overflow-hidden">
                <form onSubmit={handleSubmit} noValidate className="p-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="forgot-email" className="text-[12px] font-semibold text-stone-600">E-mail</label>
                    <input
                      id="forgot-email"
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

                  {error && (
                    <p role="alert" className="text-[12px] text-red-600 -mt-1">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="modal-btn modal-btn--primary w-full"
                  >
                    {loading ? "Odesílám…" : "Odeslat odkaz"}
                  </button>
                </form>
              </div>

              <p className="text-center text-[13px] text-stone-500">
                <Link href="/login" className="text-amber-700 font-semibold hover:underline">
                  Zpět na přihlášení
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
