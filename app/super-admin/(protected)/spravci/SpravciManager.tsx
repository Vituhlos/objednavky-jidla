"use client";

import { useState, useTransition } from "react";
import MIcon from "@/app/components/MIcon";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { saAddSuperAdmin, saRemoveSuperAdmin } from "./actions";

interface SA {
  id: number;
  email: string;
  createdAt: string;
  isSelf: boolean;
}

function AddSAForm({ onAdded }: { onAdded: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saAddSuperAdmin(fd);
      if (result.error) { setError(result.error); return; }
      (e.target as HTMLFormElement).reset();
      onAdded();
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", padding: "1.25rem", background: "rgba(22,50,74,0.04)", borderRadius: 14, border: "1px solid rgba(22,50,74,0.12)" }}>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>E-mail *</label>
        <input name="email" required type="email" placeholder="admin@firma.cz" autoComplete="off" style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid var(--sand)", fontSize: 13, width: 220 }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Heslo (min. 8 znaků) *</label>
        <div style={{ position: "relative" }}>
          <input name="password" required minLength={8} type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" style={{ padding: "0.45rem 2.5rem 0.45rem 0.75rem", borderRadius: 8, border: "1px solid var(--sand)", fontSize: 13, width: 200 }} />
          <button type="button" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9b8474", padding: 0 }}>
            <MIcon name={showPassword ? "visibility_off" : "visibility"} size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {error && <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span>}
        <button type="submit" disabled={isPending} className="v2-btn v2-btn--primary" style={{ whiteSpace: "nowrap" }}>
          <MIcon name="person_add" size={15} style={{ marginRight: 4 }} />
          {isPending ? "Přidávám…" : "Přidat správce"}
        </button>
      </div>
    </form>
  );
}

export default function SpravciManager({ admins: initialAdmins }: { admins: SA[] }) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [showAdd, setShowAdd] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<SA | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = (admin: SA) => {
    setRemoveConfirm(null);
    setError(null);
    startTransition(async () => {
      const result = await saRemoveSuperAdmin(admin.id);
      if (result.error) { setError(result.error); return; }
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Správci platformy</h1>
          <p style={{ fontSize: 13, color: "#9b8474", marginTop: 4 }}>{admins.length} správce registrováno</p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="v2-btn v2-btn--primary">
          <MIcon name={showAdd ? "close" : "person_add"} size={18} style={{ marginRight: 4 }} />
          {showAdd ? "Zrušit" : "Přidat správce"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.6rem 0.875rem", borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {showAdd && (
        <div style={{ marginBottom: "1.5rem" }}>
          <AddSAForm onAdded={() => { setShowAdd(false); window.location.reload(); }} />
        </div>
      )}

      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--sand)", background: "rgba(22,50,74,0.03)" }}>
              <th style={{ textAlign: "left", padding: "0.65rem 1rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>E-mail</th>
              <th style={{ textAlign: "left", padding: "0.65rem 1rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vytvořeno</th>
              <th style={{ padding: "0.65rem 1rem" }} />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} style={{ borderBottom: "1px solid var(--sand)", opacity: isPending ? 0.6 : 1 }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#1e3a5f,#2f4858)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MIcon name="admin_panel_settings" size={16} fill style={{ color: "#fff" }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{admin.email}</div>
                      {admin.isSelf && <div style={{ fontSize: 11, color: "#9b8474" }}>Váš účet</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: 13, color: "#9b8474" }}>
                  {admin.createdAt.slice(0, 10)}
                </td>
                <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                  {!admin.isSelf && (
                    <button
                      onClick={() => setRemoveConfirm(admin)}
                      disabled={isPending}
                      title="Odebrat správce"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 8, color: "#9b8474" }}
                      className="hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <MIcon name="person_remove" size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removeConfirm && (
        <ConfirmModal
          title="Odebrat správce"
          message={`Odebrat ${removeConfirm.email} ze správců platformy? Přijdou o přístup okamžitě.`}
          confirmLabel="Odebrat"
          onConfirm={() => handleRemove(removeConfirm)}
          onClose={() => setRemoveConfirm(null)}
        />
      )}
    </div>
  );
}
