"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import { saCreateTenant, saToggleTenant, saRegenerateJoinCode } from "./actions";

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  joinCode: string;
  active: boolean;
  createdAt: string;
  userCount: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} title="Kopírovat" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: copied ? "#4F8A53" : "#9b8474" }}>
      <MIcon name={copied ? "check" : "content_copy"} size={15} />
    </button>
  );
}

function TenantRow({ tenant, onUpdate }: { tenant: Tenant; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [joinCode, setJoinCode] = useState(tenant.joinCode);

  const toggle = () => startTransition(async () => {
    await saToggleTenant(tenant.id, !tenant.active);
    onUpdate();
  });

  const regen = () => startTransition(async () => {
    const result = await saRegenerateJoinCode(tenant.id);
    if (result.code) setJoinCode(result.code);
  });

  return (
    <tr style={{ borderBottom: "1px solid var(--sand)", opacity: isPending ? 0.6 : 1 }}>
      <td style={{ padding: "0.75rem 0.5rem" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{tenant.displayName}</div>
        <div style={{ fontSize: 12, color: "#9b8474", marginTop: 2 }}>
          <a href={`/t/${tenant.slug}`} target="_blank" rel="noreferrer" style={{ color: "#9b8474", textDecoration: "none" }}>
            /t/{tenant.slug} ↗
          </a>
        </div>
      </td>
      <td style={{ padding: "0.75rem 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <code style={{ fontSize: 13, fontFamily: "monospace", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 6 }}>{joinCode}</code>
          <CopyButton text={joinCode} />
          <button onClick={regen} title="Vygenerovat nový kód" disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#9b8474" }}>
            <MIcon name="refresh" size={15} />
          </button>
        </div>
      </td>
      <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#9b8474" }}>{tenant.userCount}</span>
      </td>
      <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
        <button
          onClick={toggle}
          disabled={isPending}
          style={{
            fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
            background: tenant.active ? "rgba(79,138,83,0.12)" : "rgba(180,83,50,0.1)",
            color: tenant.active ? "#4F8A53" : "#b45332",
          }}
        >
          {tenant.active ? "Aktivní" : "Neaktivní"}
        </button>
      </td>
      <td style={{ padding: "0.75rem 0.5rem", fontSize: 12, color: "#9b8474" }}>
        {tenant.createdAt.slice(0, 10)}
      </td>
      <td style={{ padding: "0.75rem 0.5rem" }}>
        <Link
          href={`/super-admin/najemnici/${tenant.slug}`}
          title="Spravovat uživatele (rescue)"
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#9b8474", textDecoration: "none", padding: "3px 8px", borderRadius: 8, border: "1px solid var(--sand)" }}
        >
          <MIcon name="shield_person" size={13} />
          Rescue
        </Link>
      </td>
    </tr>
  );
}

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saCreateTenant(fd);
      if (result.error) { setError(result.error); return; }
      (e.target as HTMLFormElement).reset();
      onCreated();
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", padding: "1.25rem", background: "rgba(22,50,74,0.04)", borderRadius: 14, border: "1px solid rgba(22,50,74,0.12)" }}>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Slug *</label>
        <input name="slug" required placeholder="moje-kuchyne" pattern="[a-z0-9][a-z0-9\-]{0,62}" title="Malá písmena, číslice, pomlčka" style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid var(--sand)", fontSize: 13, width: 160 }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Název kantýny *</label>
        <input name="displayName" required placeholder="Kantýna Novák s.r.o." style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid var(--sand)", fontSize: 13, width: 220 }} />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>Join kód (prázdné = auto)</label>
        <input name="joinCode" placeholder="AUTO" style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid var(--sand)", fontSize: 13, width: 120, textTransform: "uppercase" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {error && <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span>}
        <button type="submit" disabled={isPending} className="v2-btn v2-btn--primary" style={{ whiteSpace: "nowrap" }}>
          <MIcon name="add" size={16} style={{ marginRight: 4 }} />
          {isPending ? "Vytvářím…" : "Vytvořit tenanta"}
        </button>
      </div>
    </form>
  );
}

export default function TenantManager({ tenants: initialTenants }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [showCreate, setShowCreate] = useState(false);

  // Reload on server-side revalidation (optimistic UI via state update)
  const refresh = () => window.location.reload();

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)", margin: 0 }}>Tenanti</h1>
          <p style={{ fontSize: 13, color: "#9b8474", marginTop: 4 }}>{tenants.length} kantýn registrováno</p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="v2-btn v2-btn--primary"
        >
          <MIcon name={showCreate ? "close" : "add"} size={18} style={{ marginRight: 4 }} />
          {showCreate ? "Zrušit" : "Nový tenant"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ marginBottom: "1.5rem" }}>
          <CreateTenantForm onCreated={() => { setShowCreate(false); refresh(); }} />
        </div>
      )}

      {/* Tenant table */}
      {tenants.length === 0 ? (
        <div className="glass" style={{ padding: "3rem", textAlign: "center", borderRadius: 16 }}>
          <MIcon name="restaurant" size={40} fill style={{ color: "var(--sand)", marginBottom: 12 }} />
          <p style={{ color: "#9b8474", fontSize: 15 }}>Žádné kantýny zatím neexistují.</p>
          <p style={{ color: "#9b8474", fontSize: 13 }}>Vytvořte první kliknutím na „Nový tenant".</p>
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--sand)", background: "rgba(22,50,74,0.03)" }}>
                <th style={{ textAlign: "left", padding: "0.65rem 0.5rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Kantýna / Slug</th>
                <th style={{ textAlign: "left", padding: "0.65rem 0.5rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Join kód</th>
                <th style={{ textAlign: "center", padding: "0.65rem 0.5rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Uživatelé</th>
                <th style={{ textAlign: "center", padding: "0.65rem 0.5rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.65rem 0.5rem", fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vytvořeno</th>
                <th style={{ padding: "0.65rem 0.5rem" }} />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <TenantRow key={t.id} tenant={t} onUpdate={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
