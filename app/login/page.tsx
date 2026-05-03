"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            <label className="auth-label">E-mail</label>
            <input
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
            <label className="auth-label">Heslo</label>
            <input
              autoComplete="current-password"
              className="auth-input"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Vaše heslo"
              required
              type="password"
              value={password}
            />
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
            disabled={loading}
            type="submit"
          >
            {loading ? "Přihlašuji…" : "Přihlásit se"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 13, color: "#9b8474" }}>
          Ještě nemáte účet?{" "}
          <Link href="/register" style={{ color: "#D97706", fontWeight: 600, textDecoration: "none" }}>
            Registrovat se
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}
