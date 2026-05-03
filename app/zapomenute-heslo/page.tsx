"use client";

import { useState } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
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
                Obnovení hesla
              </div>
              <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Zašleme vám odkaz na obnovení</div>
            </div>
          </div>

          {sent ? (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(79,138,83,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MIcon name="mark_email_read" size={24} fill style={{ color: "#4F8A53" }} />
              </div>
              <p style={{ fontSize: 14, color: "#57534e", lineHeight: 1.6 }}>
                Pokud je e-mail <strong>{email}</strong> registrovaný, přijde vám odkaz na obnovení hesla.
                Odkaz je platný <strong>1 hodinu</strong>.
              </p>
              <p style={{ fontSize: 12, color: "#a8a29e" }}>Zkontrolujte i složku se spamem.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="auth-label">E-mail</label>
                <input
                  autoComplete="email"
                  autoFocus
                  className="auth-input"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vas@email.cz"
                  required
                  type="email"
                  value={email}
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

              <button className="auth-btn" disabled={loading} type="submit">
                {loading ? "Odesílám…" : "Odeslat odkaz"}
              </button>
            </form>
          )}

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
