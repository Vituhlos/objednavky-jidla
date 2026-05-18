"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import MIcon from "@/app/components/MIcon";
import { saCreateTenant, saToggleTenant, saRegenerateJoinCode } from "./actions";

type TenantFilter = "all" | "active" | "inactive";
type TenantSort  = "created_desc" | "created_asc" | "name" | "users_desc";

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  joinCode: string;
  active: boolean;
  createdAt: string;
  userCount: number;
  city: string;
  plan: string;
}

const PLAN_META: Record<string, { color: string; label: string }> = {
  standard:   { color: "#3B82F6", label: "Standard" },
  starter:    { color: "#94a3b8", label: "Starter" },
  enterprise: { color: "#8B5CF6", label: "Enterprise" },
};

function planMeta(plan: string) {
  return PLAN_META[plan] ?? PLAN_META.standard;
}

function tenantInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

function czechDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "dnes";
  if (days === 1) return "včera";
  if (days < 7)  return `před ${days} dny`;
  if (days < 30) return `před ${Math.floor(days / 7)} týd.`;
  if (days < 365) return `před ${Math.floor(days / 30)} měs.`;
  return `před ${Math.floor(days / 365)} r.`;
}

// ── Copy chip ──────────────────────────────────────────────────────────────────

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

// ── Tenant row ─────────────────────────────────────────────────────────────────

function TenantRow({ tenant, onUpdate }: { tenant: Tenant; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [joinCode, setJoinCode] = useState(tenant.joinCode);
  const [active, setActive] = useState(tenant.active);

  const toggle = () => {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      await saToggleTenant(tenant.id, next);
      onUpdate();
    });
  };

  const regen = () =>
    startTransition(async () => {
      const result = await saRegenerateJoinCode(tenant.id);
      if (result.code) setJoinCode(result.code);
    });

  const pm = planMeta(tenant.plan);

  return (
    <tr style={{ opacity: isPending ? 0.6 : 1 }}>
      {/* Kantýna */}
      <td className="py-3.5">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center rounded-xl shrink-0 font-display font-bold text-[13px]"
            style={{
              width: 38, height: 38,
              background: active
                ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.12))"
                : "rgba(148,163,184,0.18)",
              color: active ? "#b45309" : "#64748b",
              border: "1px solid rgba(255,255,255,0.7)",
            }}
          >
            {tenantInitials(tenant.displayName)}
          </span>
          <div className="min-w-0">
            <div className="font-display font-bold text-[13.5px] text-slate-900 truncate">{tenant.displayName}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[11px] text-slate-400">/{tenant.slug}</span>
              {tenant.city && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] text-slate-500">{tenant.city}</span>
                </>
              )}
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <span className="dot" style={{ background: pm.color }} />
                {pm.label}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Join kód */}
      <td className="py-3.5">
        <div className="flex items-center gap-1">
          <CopyChip code={joinCode} />
          <button
            onClick={regen}
            disabled={isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
            title="Vygenerovat nový kód"
          >
            <MIcon name="refresh" size={14} />
          </button>
        </div>
      </td>

      {/* Uživatelé */}
      <td className="py-3.5" style={{ textAlign: "right" }}>
        <div className="inline-flex items-center gap-1 font-display font-bold text-[14px] text-slate-900 tabular-nums">
          {tenant.userCount}
          <MIcon name="group" size={13} className="text-slate-400" />
        </div>
      </td>

      {/* Toggle + stav */}
      <td className="py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={toggle}
            disabled={isPending}
            className={`toggle ${active ? "on" : ""}`}
          />
          <span className={`text-[11.5px] font-semibold ${active ? "text-emerald-700" : "text-slate-400"}`}>
            {active ? "Aktivní" : "Neaktivní"}
          </span>
        </div>
      </td>

      {/* Vytvořeno */}
      <td className="py-3.5">
        <div className="text-[12.5px] text-slate-700 tabular-nums">{czechDate(tenant.createdAt)}</div>
        <div className="text-[10.5px] text-slate-400">{relativeTime(tenant.createdAt)}</div>
      </td>

      {/* Akce */}
      <td className="py-3.5" style={{ textAlign: "right" }}>
        <div className="inline-flex items-center gap-1.5 justify-end">
          <a
            href={`/t/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-colors"
            title="Otevřít kantýnu"
          >
            <MIcon name="open_in_new" size={15} />
          </a>
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
        </div>
      </td>
    </tr>
  );
}

// ── Create form ────────────────────────────────────────────────────────────────

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
          <div className="text-[11.5px] text-slate-500 leading-tight">Vytvoří tenant + inicializuje DB.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Slug *</span>
          <input name="slug" required placeholder="moje-kuchyne" pattern="[a-z0-9][a-z0-9\-]{0,62}" className="k-field" style={{ width: 155 }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Název kantýny *</span>
          <input name="displayName" required placeholder="Kantýna Novák s.r.o." className="k-field" style={{ width: 220 }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Město</span>
          <input name="city" placeholder="Praha" className="k-field" style={{ width: 130 }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plán</span>
          <select name="plan" className="k-field" style={{ width: 130 }}>
            <option value="standard">Standard</option>
            <option value="starter">Starter</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Join kód (auto)</span>
          <input name="joinCode" placeholder="AUTO" className="k-field mono" style={{ width: 110, textTransform: "uppercase" }} />
        </label>
        <div className="flex flex-col gap-1 self-end">
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
            {isPending ? "Vytvářím…" : "Vytvořit kantýnu"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function TenantManager({ tenants: initialTenants }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState(initialTenants);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("all");
  const [sort, setSort] = useState<TenantSort>("created_desc");

  const refresh = () => window.location.reload();

  const totalUsers  = tenants.reduce((s, t) => s + t.userCount, 0);
  const activeCount = tenants.filter((t) => t.active).length;

  let filtered = tenants.filter((t) => {
    if (filter === "active"   && !t.active) return false;
    if (filter === "inactive" &&  t.active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.displayName.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.joinCode.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === "name")         return a.displayName.localeCompare(b.displayName, "cs");
    if (sort === "users_desc")   return b.userCount - a.userCount;
    if (sort === "created_asc")  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-extrabold text-[28px] text-slate-900 leading-none mb-1">Kantýny</h2>
          <p className="text-[13px] text-slate-500">
            <strong className="text-slate-800">{tenants.length}</strong> kantýn ·{" "}
            <strong className="text-slate-800">{activeCount}</strong> aktivních ·{" "}
            <strong className="text-slate-800">{totalUsers}</strong> uživatelů celkem
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-2xl transition"
            style={{
              background: showCreate ? "rgba(148,163,184,0.25)" : "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: showCreate ? "none" : "0 6px 14px -6px rgba(234,88,12,0.4)",
              color: showCreate ? "#475569" : "white",
            }}
          >
            <MIcon name={showCreate ? "close" : "add"} size={18} />
            {showCreate ? "Zrušit" : "Nová kantýna"}
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateTenantForm onCreated={() => { setShowCreate(false); refresh(); }} />
      )}

      {/* Search + filter + sort */}
      <div className="glass-soft rounded-2xl flex items-center gap-2 px-3 py-2 mb-4">
        <MIcon name="search" size={17} className="text-slate-400 ml-1 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat podle názvu, slugu, kódu nebo města…"
          className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1 ml-2">
          {(["all", "active", "inactive"] as const).map((k) => {
            const count = k === "all" ? undefined : tenants.filter((t) => k === "active" ? t.active : !t.active).length;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl transition ${
                  filter === k ? "tab-active text-amber-900" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {k === "all" ? "Vše" : k === "active" ? "Aktivní" : "Neaktivní"}
                {count !== undefined && (
                  <span className="ml-1.5 font-mono text-[10.5px] opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="w-px h-5 bg-slate-300/40 mx-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as TenantSort)}
          className="text-[12px] font-semibold text-slate-600 bg-transparent outline-none cursor-pointer pr-1"
        >
          <option value="created_desc">Nejnovější</option>
          <option value="created_asc">Nejstarší</option>
          <option value="name">Podle názvu</option>
          <option value="users_desc">Podle uživatelů</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
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
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <MIcon name="info" size={13} className="text-slate-400" />
              Tip: <em className="not-italic text-slate-600">Záchrana</em> vám umožní spravovat uživatele kantýny.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
