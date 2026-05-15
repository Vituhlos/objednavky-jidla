"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MIcon from "@/app/components/MIcon";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Neplatný kód.");
        return;
      }
      router.push(`/t/${data.slug}/register?code=${encodeURIComponent(code.trim().toUpperCase())}`);
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 8px 24px -8px rgba(245,158,11,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon name="group_add" size={26} fill className="text-white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#D97706,#EA580C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Připojit se
              </div>
              <div style={{ fontSize: 13, color: "#9b8474", marginTop: 2 }}>Zadejte kód od správce kantýny</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="auth-label">Registrační kód</label>
              <input
                autoComplete="off"
                autoFocus
                className="auth-input"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-YYYY"
                required
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                type="text"
                value={code}
              />
            </div>

            {error && (
              <div style={{ padding: "0.6rem 0.875rem", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", color: "#b91c1c", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button className="auth-btn" disabled={loading || !code.trim()} type="submit">
              {loading ? "Hledám…" : "Pokračovat"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
