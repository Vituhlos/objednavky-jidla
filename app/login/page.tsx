"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

function LoginInner() {
  const params = useSearchParams();
  const rawFrom = params.get("from") || "/";
  const from = /^\/(?!\/)/.test(rawFrom) ? rawFrom : "/";
  const verify = params.get("verify");
  const reset = params.get("reset");
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toast =
    verify === "success" ? { ok: true, msg: "E-mail ověřen. Nyní se přihlaste." }
    : verify === "expired" ? { ok: false, msg: "Ověřovací odkaz expiroval. Zaregistrujte se znovu." }
    : verify === "invalid" ? { ok: false, msg: "Neplatný ověřovací odkaz." }
    : reset === "success" ? { ok: true, msg: "Heslo bylo změněno. Přihlaste se." }
    : urlError ? { ok: false, msg: "Nesprávný e-mail nebo heslo." }
    : null;

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setFormError("Nesprávný e-mail nebo heslo.");
      setLoading(false);
    } else {
      window.location.href = from;
    }
  }

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl: from });
  }

  return (
    <div className="k-shell">
      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav flex items-center justify-center min-h-full">
        <div className="max-w-sm w-full flex flex-col gap-4 py-6">

          {/* Branding */}
          <div className="flex flex-col items-center gap-2 mb-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center brand-badge">
              <MIcon name="restaurant" size={28} fill className="text-white" />
            </div>
            <span className="font-display font-extrabold text-[21px] brand-grad--text">
              Kantýna
            </span>
          </div>

          {/* Toast z URL params */}
          {toast && (
            <div
              className="px-3 py-2.5 rounded-2xl text-[13px] leading-relaxed"
              style={
                toast.ok
                  ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#15803d" }
                  : { background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", color: "#b91c1c" }
              }
            >
              {toast.msg}
            </div>
          )}

          {/* Přihlašovací karta */}
          <div className="glass-card rounded-3xl overflow-hidden">
            <form onSubmit={handleCredentials} noValidate className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="login-email" className="text-[12px] font-semibold text-stone-600">E-mail</label>
                <input
                  id="login-email"
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
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="text-[12px] font-semibold text-stone-600">Heslo</label>
                  <Link
                    href="/zapomenute-heslo"
                    className="text-xs text-amber-700 hover:underline font-medium"
                  >
                    Zapomenuté heslo?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              {formError && (
                <p role="alert" className="text-[12px] text-red-600 -mt-1">{formError}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="modal-btn modal-btn--primary w-full"
              >
                {loading ? "Přihlašuji…" : "Přihlásit se"}
              </button>
            </form>

            <div className="px-6 flex items-center gap-3 -mt-1 mb-1">
              <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
              <span className="text-[11px] text-stone-500 font-medium shrink-0">nebo</span>
              <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
            </div>

            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="modal-btn modal-btn--secondary w-full flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Přihlásit přes Google
              </button>
            </div>
          </div>

          <p className="text-center text-[13px] text-stone-500">
            Ještě nemáš účet?{" "}
            <Link href="/registrace" className="text-amber-700 font-semibold hover:underline">
              Zaregistruj se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="k-shell">
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-[13px] text-stone-500">Načítám přihlášení…</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}
