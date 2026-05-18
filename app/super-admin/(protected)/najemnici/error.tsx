"use client";

import { useEffect } from "react";
import MIcon from "@/app/components/MIcon";

export default function NajemniciError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <MIcon name="error" size={40} fill style={{ color: "#dc2626", marginBottom: 12 }} />
      <p style={{ color: "#b91c1c", fontWeight: 600, fontSize: 15 }}>Chyba při načítání tenantů</p>
      <p style={{ color: "#9b8474", fontSize: 13, marginTop: 8 }}>{error.message}</p>
      <button className="v2-btn v2-btn--primary" onClick={reset} style={{ marginTop: 20 }}>
        Zkusit znovu
      </button>
    </div>
  );
}
