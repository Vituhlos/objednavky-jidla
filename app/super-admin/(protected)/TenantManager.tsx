"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import { saCreateTenant, saToggleTenant, saRegenerateJoinCode } from "./actions";

type TenantFilter = "all" | "active" | "inactive";

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  joinCode: string;
  active: boolean;
  createdAt: string;
  userCount: number;
}

function tenantInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function CopyChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="inline-flex items-center gap-1.5">
      <code
        className="font-mono text-[12.5px] text-slate-700 px-2 py-0.5 rounded-lg"
        style={{ background: "rgba(26,18,8,0.06)" }}
      >
        {code}
      </code>
      <button
        onClick={copy}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
        title="Kopírovat"
      >
        <MIcon name={copied ? "check" : "content_copy"} size={14} />
      </button>
    </div>
  );
}

function TenantRow({ tenant, onUpdate }: { tenant: Tenant; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [joinCode, setJoinCode] = useState(tenant.joinCode);

  const toggle = () =>
    startTransition(async () => {
      await saToggleTenant(tenant.id, !tenant.active);
      onUpdate();
    });

  const regen = () =>
    startTransition(async () => {
      const result = await saRegenerateJoinCode(tenant.id);
      if (result.code) setJoinCode(result.code);
    });

  return (
    <tr style={{ opacity: isPending ? 0.6 : 1 }}>
      <td className="py-3.5">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center rounded-xl shrink-0 font-display font-bold text-[13px]"
            style={{
              width: 38, height: 38,
              background: tenant.active
                ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.12))"
                : "rgba(148,163,184,0.18)",
              color: tenant.active ? "#b45309" : "#64748b",
              border: "1px solid rgba(255,255,255,0.7)",
            }}
          >
            {tenantInitials(tenant.displayName)}
          </span>
          <div className="min-w-0">
            <div className="font-display font-bold text-[13.5px] text-slate-900 truncate">{tenant.displayName}</div>
            <a
              href={`/t/${tenant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11.5px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              /t/{tenant.slug} ↗
            </a>
          </div>
        </div>
      </td>
      <td className="py-3.5">
        <div className="flex items-center gap-1">
          <CopyChip code={joinCode} />
          <button
            onClick={regen}
            title="Vygenerovat nový kód"
            disabled={isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <MIcon name="refresh" size={14} />
          </button>
        </div>
      </td>
      <td className="py-3.5" style={{ textAlign: "right" }}>
        <div className="inline-flex items-center gap-1 font-display font-bold text-[14px] text-slate-900 tabular-nums">
          {tenant.userCount}
          <MIcon name="group" size={13} className="text-slate-400" />
        </div>
      </td>
      <td className="py-3.5">
        <button
          onClick={toggle}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-colors"
          style={{
            background: tenant.active ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.15)",
            color: tenant.active ? "#047857" : "#64748b",
          }}
        >
          {tenant.active ? "Aktivní" : "Neaktivní"}
        </button>
      </td>
      <td className="py-3.5">
        <div className="text-[12.5px] text-slate-700 tabular-nums">{tenant.createdAt.slice(0, 10)}</div>
      </td>
      <td className="py-3.5" style={{ textAlign: "right" }}>
        <Link
          href={`/super-admin/najemnici/${tenant.slug}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold font-display px-3 py-1.5 rounded-xl transition-colors"
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.25)",
            color: "#b45309",
          }}
        >
          <MIcon name="health_and_safety" size={14} fill /> Záchrana
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
    <form onSubmit={handleSubmit} className="glass rounded-3xl p-5 mb-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/55">
        <span
          className="inline-flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: "0 6px 14px -6px rgba(245,158,11,0.5)",
          }}
        >
          <MIcon name="add_business" size={17} fill style={{ color: "white" }} />
        </span>
        <div>
          <div className="font-display font-bold text-[14.5px] text-slate-900 leading-tight">Nová kantýna</div>
          <div className="text-[11.5px] text-slate-500 leading-tight">Vytvořit nový tenant s join kódem.</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Slug *</span>
          <input
            name="slug"
            required
            placeholder="moje-kuchyne"
            pattern="[a-z0-9][a-z0-9\-]{0,62}"
            title="Malá písmena, číslice, pomlčka"
            className="k-field"
            style={{ width: 160 }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Název kantýny *</span>
          <input name="displayName" required placeholder="Kantýna Novák s.r.o." className="k-field" style={{ width: 220 }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Join kód (prázdné = auto)</span>
          <input name="joinCode" placeholder="AUTO" className="k-field mono" style={{ width: 120, textTransform: "uppercase" }} />
        </label>
        <div className="flex flex-col gap-1">
          {error && <span className="text-[12px] text-red-600">{error}</span>}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-2xl text-white transition disabled:opacity-55 whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)",
            }}
          >
            <MIcon name="add" size={16} />
            {isPending ? "Vytvářím…" : "Vytvořit tenanta"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function TenantManager({ tenants: initialTenants }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("all");

  const refresh = () => window.location.reload();

  const totalUsers  = tenants.reduce((s, t) => s + t.userCount, 0);
  const activeCount = tenants.filter((t) => t.active).length;

  const filtered = tenants.filter((t) => {
    if (filter === "active" && !t.active) return false;
    if (filter === "inactive" && t.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.displayName.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || t.joinCode.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-extrabold text-[24px] text-slate-900 leading-none mb-1">Kantýny</h2>
          <p className="text-[13px] text-slate-500">
            <strong className="text-slate-800">{tenants.length}</strong> kantýn ·{" "}
            <strong className="text-slate-800">{activeCount}</strong> aktivních ·{" "}
            <strong className="text-slate-800">{totalUsers}</strong> uživatelů celkem
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-2xl text-white transition"
          style={{
            background: showCreate ? "rgba(148,163,184,0.3)" : "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: showCreate ? "none" : "0 6px 14px -6px rgba(234,88,12,0.4)",
            color: showCreate ? "#475569" : "white",
          }}
        >
          <MIcon name={showCreate ? "close" : "add"} size={18} />
          {showCreate ? "Zrušit" : "Nová kantýna"}
        </button>
      </div>

      {showCreate && (
        <CreateTenantForm onCreated={() => { setShowCreate(false); refresh(); }} />
      )}

      {/* Search + filter bar */}
      <div className="glass-soft rounded-2xl flex items-center gap-2 px-3 py-2 mb-4">
        <MIcon name="search" size={17} className="text-slate-400 ml-1 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat podle názvu, slugu nebo kódu…"
          className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1 ml-2 pr-1">
          {(["all", "active", "inactive"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-[12px] font-semibold px-3 py-1 rounded-xl transition ${
                filter === k ? "tab-active text-amber-900" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {k === "all" ? "Vše" : k === "active" ? `Aktivní` : "Neaktivní"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 && !showCreate ? (
        <div className="glass rounded-3xl p-12 text-center">
          <MIcon name="restaurant" size={40} fill className="text-slate-300 mb-3" />
          <p className="text-slate-500 text-[15px]">Žádné kantýny neodpovídají filtru.</p>
        </div>
      ) : (
        <div className="glass rounded-3xl overflow-hidden">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Kantýna</th>
                <th>Kód pro připojení</th>
                <th style={{ textAlign: "right" }}>Uživatelé</th>
                <th>Stav</th>
                <th>Vytvořeno</th>
                <th style={{ textAlign: "right" }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TenantRow key={t.id} tenant={t} onUpdate={refresh} />
              ))}
            </tbody>
          </table>
          <div
            className="px-4 py-2.5 border-t border-white/50 flex items-center justify-between text-[11.5px] text-slate-500"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <span>Zobrazeno <strong className="text-slate-700">{filtered.length}</strong> z {tenants.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
