"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) { setError("Hesla se neshodují."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Chyba při obnově hesla.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <p style={{ fontSize: 14, color: "#b91c1c" }}>Neplatný nebo chybějící odkaz pro obnovení hesla.</p>
        <Link href="/zapomenute-heslo" style={{ color: "#D97706", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
          Požádat o nový odkaz
        </Link>
      </div>
    );
  }

  return done ? (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "rgba(79,138,83,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <MIcon name="check_circle" size={24} fill style={{ color: "#4F8A53" }} />
      </div>
      <p style={{ fontSize: 14, color: "#57534e" }}>Heslo bylo úspěšně změněno.</p>
      <p style={{ fontSize: 12, color: "#a8a29e" }}>Za chvíli budete přesměrováni na přihlášení…</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label className="auth-label">Nové heslo</label>
        <input
          autoComplete="new-password"
          autoFocus
          className="auth-input"
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Alespoň 6 znaků"
          required
          type="password"
          value={password}
        />
      </div>
      <div>
        <label className="auth-label">Nové heslo znovu</label>
        <input
          autoComplete="new-password"
          className={`auth-input${passwordMismatch ? " auth-input--error" : ""}`}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="Zopakujte heslo"
          required
          type="password"
          value={passwordConfirm}
        />
        {passwordMismatch && <p className="auth-field-error">Hesla se neshodují.</p>}
      </div>

      {error && (
        <div style={{
          padding: "0.6rem 0.875rem", borderRadius: 12,
          background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)",
          color: "#b91c1c", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <button
        className="auth-btn"
        disabled={loading || passwordMismatch}
        type="submit"
      >
        {loading ? "Ukládám…" : "Nastavit nové heslo"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto" }}>
      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem" }}>
        <div className="glass scale-in" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "2rem", position: "relative", zIndex: 10 }}>
          {/* Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 10 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 8px 24px -8px rgba(245,158,11,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MIcon name="lock_reset" size={26} fill className="text-white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="font-display" style={{
                fontSize: 22, fontWeight: 800,
                background: "linear-gradient(135deg,#D97706,#EA580C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Nové heslo
              </div>
              <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Zadejte nové heslo pro váš účet</div>
            </div>
          </div>

          <Suspense fallback={<div style={{ textAlign: "center", color: "#a8a29e", fontSize: 13 }}>Načítám…</div>}>
            <ResetForm />
          </Suspense>

          <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 13, color: "#9b8474" }}>
            <Link href="/login" style={{ color: "#D97706", fontWeight: 600, textDecoration: "none" }}>
              ← Zpět na přihlášení
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
