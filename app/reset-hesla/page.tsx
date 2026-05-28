"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import PageHeader from "@/app/components/PageHeader";

function ResetHeslaInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)" }}
          >
            <MIcon name="link_off" size={28} style={{ color: "#b91c1c" }} />
          </div>
          <div>
            <p className="font-display font-bold text-[17px] text-stone-900">Neplatný odkaz</p>
            <p className="text-[13px] text-stone-500 mt-1.5 leading-relaxed">
              Tento odkaz pro reset hesla je neplatný nebo vypršel.
            </p>
          </div>
          <Link href="/zapomenute-heslo" className="modal-btn modal-btn--primary w-full mt-1 text-center">
            Požádat o nový odkaz
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Reset hesla selhal. Zkuste to znovu.");
        return;
      }
      router.replace("/login?reset=success");
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <form onSubmit={handleSubmit} noValidate className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="reset-password" className="text-[12px] font-semibold text-stone-600">Nové heslo</label>
          <div className="relative">
            <input
              id="reset-password"
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
            >
              <MIcon name={showPass ? "visibility_off" : "visibility"} size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="reset-confirm" className="text-[12px] font-semibold text-stone-600">Potvrzení hesla</label>
          <input
            id="reset-confirm"
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Zopakuj nové heslo"
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
          {loading ? "Ukládám…" : "Nastavit nové heslo"}
        </button>
      </form>
    </div>
  );
}

function ResetFallback() {
  return (
    <div className="k-shell">
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-[13px] text-stone-500">Načítám…</p>
      </div>
    </div>
  );
}

export default function ResetHeslaPage() {
  return (
    <Suspense fallback={<ResetFallback />}>
      <div className="k-shell">
        <PageHeader title="Reset hesla" mobileTitle="Reset hesla" />

        <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav flex items-start justify-center">
          <div className="max-w-sm w-full flex flex-col gap-4 py-4">
            <div className="flex flex-col items-center gap-1 mb-1">
              <p className="font-display font-bold text-[18px] text-stone-900">Nové heslo</p>
              <p className="text-[13px] text-stone-500">Zvol si nové přihlašovací heslo</p>
            </div>

            <ResetHeslaInner />

            <p className="text-center text-[13px] text-stone-500">
              <Link href="/login" className="text-amber-700 font-semibold hover:underline">
                Zpět na přihlášení
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
