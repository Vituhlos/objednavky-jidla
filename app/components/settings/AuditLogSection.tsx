"use client";

import { useState } from "react";
import type { AuditEntry } from "@/lib/audit";
import MIcon from "../MIcon";
import { ACTION_LABELS } from "./constants";
import { formatTimestamp } from "./settings-utils";
import { SettingsSection } from "./SettingsPrimitives";

/**
 * Kdo co kdy změnil.
 *
 * Filtr v záhlaví nabízí jen ty typy akcí, které se v záznamech opravdu
 * vyskytují — prázdná položka v seznamu by slibovala něco, co po vybrání
 * ukáže prázdno.
 */
export function AuditLogSection({
  entries,
  isActive,
}: {
  entries: AuditEntry[];
  isActive: boolean;
}) {
  const [auditFilter, setAuditFilter] = useState("all");

  if (!isActive) return null;

  const filtered = auditFilter === "all" ? entries : entries.filter((e) => e.action === auditFilter);

  return (
    <SettingsSection
      icon="history"
      title="Historie změn"
      action={
        entries.length > 0 ? (
          <select
            className="text-[11.5px] px-2 py-1 rounded-lg glass-btn text-stone-600 font-medium bg-transparent cursor-pointer"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
          >
            <option value="all">Vše ({entries.length})</option>
            {Object.entries(ACTION_LABELS).filter(([key]) => entries.some((e) => e.action === key)).map(([key, label]) => (
              <option key={key} value={key}>{label} ({entries.filter((e) => e.action === key).length})</option>
            ))}
          </select>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <MIcon name="manage_history" size={22} style={{ color: "#94a3b8" }} />
          </div>
          <p className="empty-state__title">Zatím žádné záznamy</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[12.5px] text-stone-400 py-2">Žádné záznamy tohoto typu.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 -mb-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                <th className="text-left px-4 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide">Čas</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide">Akce</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden sm:table-cell">Oddělení</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden sm:table-cell">Osoba</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-500 text-[10.5px] uppercase tracking-wide hidden md:table-cell">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-white/30 last:border-0 hover:bg-white/20 transition">
                  <td className="px-4 py-2 text-stone-500 font-mono text-[11px]">{formatTimestamp(entry.ts)}</td>
                  <td className="px-3 py-2 font-medium text-stone-700">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="px-3 py-2 text-stone-500 hidden sm:table-cell">{entry.department ?? "—"}</td>
                  <td className="px-3 py-2 text-stone-500 hidden sm:table-cell">{entry.personName ?? "—"}</td>
                  <td className="px-3 py-2 text-stone-400 hidden md:table-cell">{entry.details ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  );
}
