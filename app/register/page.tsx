"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailMismatch = emailConfirm.length > 0 && email !== emailConfirm;
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== emailConfirm) { setError("E-maily se neshodují."); return; }
    if (password !== passwordConfirm) { setError("Hesla se neshodují."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registrace se nezdařila.");
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
      <div className="glass scale-in" style={{ width: "100%", maxWidth: 420, borderRadius: 24, padding: "2rem", position: "relative", zIndex: 10 }}>
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
            <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Vytvoření nového účtu</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label className="auth-label">Jméno</label>
              <input autoComplete="given-name" className="auth-input" onChange={(e) => setFirstName(e.target.value)} placeholder="Jana" required type="text" value={firstName} />
            </div>
            <div>
              <label className="auth-label">Příjmení</label>
              <input autoComplete="family-name" className="auth-input" onChange={(e) => setLastName(e.target.value)} placeholder="Nováková" required type="text" value={lastName} />
            </div>
          </div>

          <div>
            <label className="auth-label">E-mail</label>
            <input autoComplete="email" className="auth-input" onChange={(e) => setEmail(e.target.value)} placeholder="vas@email.cz" required type="email" value={email} />
          </div>

          <div>
            <label className="auth-label">E-mail znovu</label>
            <input
              autoComplete="off"
              className={`auth-input${emailMismatch ? " auth-input--error" : ""}`}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder="Zopakujte e-mail"
              required
              type="email"
              value={emailConfirm}
            />
            {emailMismatch && <p className="auth-field-error">E-maily se neshodují.</p>}
          </div>

          <div>
            <label className="auth-label">Heslo</label>
            <input autoComplete="new-password" className="auth-input" onChange={(e) => setPassword(e.target.value)} placeholder="Alespoň 6 znaků" required type="password" value={password} />
          </div>

          <div>
            <label className="auth-label">Heslo znovu</label>
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
            <div style={{ padding: "0.6rem 0.875rem", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", color: "#b91c1c", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="auth-btn" disabled={loading || emailMismatch || passwordMismatch} type="submit">
            {loading ? "Registruji…" : "Vytvořit účet"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 13, color: "#9b8474" }}>
          Již máte účet?{" "}
          <Link href="/login" style={{ color: "#D97706", fontWeight: 600, textDecoration: "none" }}>Přihlásit se</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
