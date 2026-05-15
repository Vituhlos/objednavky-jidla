"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MIcon from "@/app/components/MIcon";

export default function SALoginClient({ bootstrapMode }: { bootstrapMode: boolean }) {
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
      const body = bootstrapMode
        ? { email, bootstrapPassword: password }
        : { email, password };
      const res = await fetch("/super-admin/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Přihlášení se nezdařilo."); return; }
      router.push("/super-admin");
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
        <div className="glass scale-in" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "2rem", zIndex: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#1e3a5f,#2f4858)", boxShadow: "0 8px 24px -8px rgba(22,50,74,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon name="admin_panel_settings" size={26} fill className="text-white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)" }}>
                Super Admin
              </div>
              <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>
                {bootstrapMode ? "Vytvoření prvního správce platformy" : "Přihlášení do správy platformy"}
              </div>
            </div>
          </div>

          {bootstrapMode && (
            <div style={{ padding: "0.6rem 0.875rem", borderRadius: 12, background: "rgba(197,122,28,0.1)", border: "1px solid rgba(197,122,28,0.3)", color: "#92560a", fontSize: 13, marginBottom: "1rem" }}>
              Žádný správce neexistuje. Vytvořte první účet super administrátora.
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="auth-label">E-mail</label>
              <input autoComplete="email" autoFocus className="auth-input" onChange={(e) => setEmail(e.target.value)} placeholder="admin@firma.cz" required type="email" value={email} />
            </div>
            <div>
              <label className="auth-label">{bootstrapMode ? "Heslo (min. 8 znaků)" : "Heslo"}</label>
              <input autoComplete={bootstrapMode ? "new-password" : "current-password"} className="auth-input" minLength={bootstrapMode ? 8 : 1} onChange={(e) => setPassword(e.target.value)} placeholder={bootstrapMode ? "Silné heslo" : "Vaše heslo"} required type="password" value={password} />
            </div>

            {error && <div style={{ padding: "0.6rem 0.875rem", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", color: "#b91c1c", fontSize: 13 }}>{error}</div>}

            <button className="auth-btn" disabled={loading} type="submit" style={{ background: "linear-gradient(135deg,#1e3a5f,#2f4858)" }}>
              {loading ? (bootstrapMode ? "Vytvářím…" : "Přihlašuji…") : (bootstrapMode ? "Vytvořit správce" : "Přihlásit se")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
