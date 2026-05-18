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

function pwdStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "—", color: "#cbd5e1" };
  let s = 0;
  if (pwd.length >= 8)  s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  const labels = ["Slabé", "Slabé", "Průměrné", "Dobré", "Silné", "Velmi silné"];
  const colors = ["#ef4444", "#f97316", "#F59E0B", "#84cc16", "#10b981", "#059669"];
  return { score: s, label: labels[s], color: colors[s] };
}

function AddSAForm({ onAdded }: { onAdded: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const strength = pwdStrength(pwd);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saAddSuperAdmin(fd);
      if (result.error) { setError(result.error); return; }
      (e.target as HTMLFormElement).reset();
      setPwd("");
      onAdded();
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
          <MIcon name="person_add" size={17} fill style={{ color: "white" }} />
        </span>
        <div>
          <div className="font-display font-bold text-[14.5px] text-slate-900 leading-tight">Nový super admin</div>
          <div className="text-[11.5px] text-slate-500 leading-tight">Účet okamžitě získá plný přístup.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">E-mail *</span>
          <div className="relative">
            <MIcon name="mail" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              name="email"
              required
              type="email"
              placeholder="jmeno@kantyna.cz"
              autoComplete="off"
              className="k-field"
              style={{ paddingLeft: 38, width: 220 }}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Heslo (min. 8 znaků) *</span>
          <div className="relative">
            <MIcon name="lock" size={15} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              name="password"
              required
              minLength={8}
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="k-field mono"
              style={{ paddingLeft: 38, paddingRight: 40, width: 200 }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <MIcon name={showPwd ? "visibility_off" : "visibility"} size={16} />
            </button>
          </div>
          {pwd && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200/60">
                <div
                  className="h-full transition-all"
                  style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                />
              </div>
              <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: strength.color }}>
                {strength.label}
              </span>
            </div>
          )}
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
            <MIcon name="person_add" size={15} />
            {isPending ? "Přidávám…" : "Přidat správce"}
          </button>
        </div>
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
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-extrabold text-[24px] text-slate-900 leading-none mb-1">Super admini</h2>
          <p className="text-[13px] text-slate-500">
            <strong className="text-slate-800">{admins.length}</strong> účtů s úplným přístupem ke všem kantýnám.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-4 py-2 rounded-2xl transition"
          style={{
            background: showAdd ? "rgba(148,163,184,0.25)" : "linear-gradient(135deg,#F59E0B,#EA580C)",
            boxShadow: showAdd ? "none" : "0 6px 14px -6px rgba(234,88,12,0.4)",
            color: showAdd ? "#475569" : "white",
          }}
        >
          <MIcon name={showAdd ? "close" : "person_add"} size={18} />
          {showAdd ? "Zrušit" : "Přidat správce"}
        </button>
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 text-[13px] text-red-700"
          style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          {error}
        </div>
      )}

      {showAdd && (
        <AddSAForm onAdded={() => { setShowAdd(false); window.location.reload(); }} />
      )}

      {/* Table */}
      <div className="glass rounded-3xl overflow-hidden">
        <table className="k-table">
          <thead>
            <tr>
              <th>Správce</th>
              <th>Vytvořeno</th>
              <th style={{ textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} style={{ opacity: isPending ? 0.6 : 1 }}>
                <td className="py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex items-center justify-center rounded-xl shrink-0"
                      style={{
                        width: 34, height: 34,
                        background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                        boxShadow: "0 6px 14px -6px rgba(234,88,12,0.35)",
                      }}
                    >
                      <MIcon name="admin_panel_settings" size={16} fill style={{ color: "white" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] text-slate-900">{admin.email}</div>
                      {admin.isSelf && <div className="text-[11px] text-slate-400">Váš účet</div>}
                    </div>
                  </div>
                </td>
                <td className="py-3.5">
                  <span className="text-[12.5px] text-slate-500 tabular-nums">{admin.createdAt.slice(0, 10)}</span>
                </td>
                <td className="py-3.5" style={{ textAlign: "right" }}>
                  {!admin.isSelf && (
                    <button
                      onClick={() => setRemoveConfirm(admin)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Odebrat správce"
                    >
                      <MIcon name="person_remove" size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-[13px] text-slate-400">
                  Žádní správci.
                </td>
              </tr>
            )}
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
