"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Přihlášení se nezdařilo.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto" }}>
      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem" }}>
      {/* Card */}
      <div className="glass scale-in" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "2rem", position: "relative", zIndex: 10 }}>
        <h1 className="sr-only">Přihlášení</h1>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 10 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: "0 8px 24px -8px rgba(245,158,11,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MIcon name="restaurant" size={26} fill className="text-white" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="font-display" style={{
              fontSize: 22, fontWeight: 800,
              background: "linear-gradient(135deg,#D97706,#EA580C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Kantýna
            </div>
            <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Přihlaste se ke svému účtu</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="email" className="auth-label">E-mail</label>
            <input
              id="email"
              autoComplete="email"
              className="auth-input"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label htmlFor="password" className="auth-label">Heslo</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                autoComplete="current-password"
                className="auth-input"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Vaše heslo"
                required
                type={showPassword ? "text" : "password"}
                value={password}
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#9b8474" }}
                aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
              >
                <MIcon name={showPassword ? "visibility_off" : "visibility"} size={17} />
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                padding: "0.6rem 0.875rem", borderRadius: 12,
                background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)",
                color: "#b91c1c", fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="auth-btn"
            disabled={loading}
            type="submit"
          >
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
          <Link href="/zapomenute-heslo" style={{ color: "#D97706", fontWeight: 600, textDecoration: "none", fontSize: 13, display: "inline-block", padding: "0.5rem 0.25rem" }}>
            Zapomněli jste heslo?
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: "0.25rem", fontSize: 13, color: "#9b8474" }}>
          Ještě nemáte účet?{" "}
          <Link href="/register" style={{ color: "#D97706", fontWeight: 600, textDecoration: "none", display: "inline-block", padding: "0.5rem 0.25rem" }}>
            Registrovat se
          </Link>
        </p>
        <div style={{ marginTop: "1.25rem", borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: "1rem" }}>
          <Link
            href="/"
            className="group"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "0.75rem 1rem",
              borderRadius: 14,
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 1px 4px -1px rgba(0,0,0,0.06)",
              textDecoration: "none",
              color: "#57534e",
              fontSize: 13,
              fontWeight: 600,
              transition: "background 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.85)"; e.currentTarget.style.boxShadow = "0 2px 8px -2px rgba(0,0,0,0.10)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.55)"; e.currentTarget.style.boxShadow = "0 1px 4px -1px rgba(0,0,0,0.06)"; }}
          >
            <MIcon name="storefront" size={16} style={{ color: "#D97706" }} />
            Pokračovat bez přihlášení
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
