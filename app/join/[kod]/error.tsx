"use client";

import { useEffect } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";

export default function JoinError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="glass scale-in" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "2rem", textAlign: "center" }}>
        <MIcon name="error" size={36} fill style={{ color: "#dc2626", marginBottom: 12 }} />
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c" }}>Nastala chyba</div>
        <p style={{ fontSize: 14, color: "#9b8474", margin: "0.75rem 0 1.5rem" }}>
          Zkuste stránku obnovit nebo zadejte kód znovu.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="v2-btn v2-btn--primary" onClick={reset} style={{ fontSize: 14 }}>
            Zkusit znovu
          </button>
          <Link className="v2-btn v2-btn--secondary" href="/join" style={{ fontSize: 14 }}>
            Zadat kód
          </Link>
        </div>
      </div>
    </div>
  );
}
