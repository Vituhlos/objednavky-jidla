"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MIcon from "@/app/components/MIcon";

export default function JoinRegisterForm({ tenantSlug, initialCode }: { tenantSlug: string; initialCode: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
      const res = await fetch(`/t/${tenantSlug}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, password, joinCode: initialCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registrace se nezdařila."); return; }
      router.push(`/t/${tenantSlug}`);
      router.refresh();
    } catch {
      setError("Chyba připojení. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label className="auth-label">Jméno</label>
          <input autoComplete="given-name" autoFocus className="auth-input" onChange={(e) => setFirstName(e.target.value)} placeholder="Jana" required type="text" value={firstName} />
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
        <input autoComplete="off" className={`auth-input${emailMismatch ? " auth-input--error" : ""}`} onChange={(e) => setEmailConfirm(e.target.value)} placeholder="Zopakujte e-mail" required type="email" value={emailConfirm} />
        {emailMismatch && <p className="auth-field-error">E-maily se neshodují.</p>}
      </div>

      <div>
        <label className="auth-label">Heslo</label>
        <div style={{ position: "relative" }}>
          <input autoComplete="new-password" className="auth-input" onChange={(e) => setPassword(e.target.value)} placeholder="Alespoň 6 znaků" required style={{ paddingRight: "2.5rem" }} type={showPassword ? "text" : "password"} value={password} />
          <button type="button" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} style={{ position: "absolute", right: "0.65rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem", color: "#9b8474" }} aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}>
            <MIcon name={showPassword ? "visibility_off" : "visibility"} size={17} />
          </button>
        </div>
      </div>
      <div>
        <label className="auth-label">Heslo znovu</label>
        <div style={{ position: "relative" }}>
          <input autoComplete="new-password" className={`auth-input${passwordMismatch ? " auth-input--error" : ""}`} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Zopakujte heslo" required style={{ paddingRight: "2.5rem" }} type={showPasswordConfirm ? "text" : "password"} value={passwordConfirm} />
          <button type="button" tabIndex={-1} onClick={() => setShowPasswordConfirm((s) => !s)} style={{ position: "absolute", right: "0.65rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem", color: "#9b8474" }} aria-label={showPasswordConfirm ? "Skrýt heslo" : "Zobrazit heslo"}>
            <MIcon name={showPasswordConfirm ? "visibility_off" : "visibility"} size={17} />
          </button>
        </div>
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
  );
}
