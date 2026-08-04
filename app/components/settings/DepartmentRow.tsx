"use client";

import { memo, useState } from "react";
import type { DepartmentInfo } from "@/lib/departments";
import { ConfirmModal } from "../ConfirmModal";
import { ACCENT_COLORS, ACCENT_OPTIONS } from "./constants";
import { SettingsField } from "./SettingsPrimitives";

export const DepartmentRow = memo(function DepartmentRow({
  dept,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  dept: DepartmentInfo;
  onSave: (id: number, data: Partial<{ label: string; emailLabel: string; accent: string }>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [label, setLabel] = useState(dept.label);
  const [emailLabel, setEmailLabel] = useState(dept.emailLabel);
  const [accent, setAccent] = useState(dept.accent);
  const dotColor = ACCENT_COLORS[dept.accent] ?? "#94a3b8";

  if (!editing) {
    return (
      <div className="glass-soft rounded-2xl px-3 py-2.5 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[13px] font-semibold text-stone-800 flex-1 min-w-0 truncate">{dept.label}</span>
        <span className="text-[11px] text-stone-400 hidden sm:inline shrink-0">({dept.name})</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            aria-label={`Přesunout ${dept.label} nahoru`}
            className="inline-flex w-10 h-10 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isFirst}
            onClick={() => onMoveUp(dept.id)}
            type="button"
          >↑</button>
          <button
            aria-label={`Přesunout ${dept.label} dolů`}
            className="inline-flex w-10 h-10 rounded-full items-center justify-center text-stone-400 hover:bg-white/60 transition disabled:opacity-30"
            disabled={isLast}
            onClick={() => onMoveDown(dept.id)}
            type="button"
          >↓</button>
          <button
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg glass-btn text-stone-600"
            onClick={() => setEditing(true)}
            type="button"
          >Upravit</button>
          <button
            aria-label={`Smazat oddělení ${dept.label}`}
            className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg text-red-600 transition"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)" }}
            onClick={() => setConfirmDelete(true)}
            type="button"
          >Smazat</button>
        </div>
        {confirmDelete && (
          <ConfirmModal
            message={`Oddělení „${dept.label}" bude trvale smazáno.`}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => { onDelete(dept.id); setConfirmDelete(false); }}
            title="Smazat oddělení"
          />
        )}
      </div>
    );
  }

  return (
    <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SettingsField label="Zobrazovaný název">
          <input className="modal-input" onChange={(event) => setLabel(event.target.value)} value={label} />
        </SettingsField>
        <SettingsField label="Název v e-mailu">
          <input className="modal-input" onChange={(event) => setEmailLabel(event.target.value)} value={emailLabel} />
        </SettingsField>
        <SettingsField label="Barva">
          <select className="k-select" onChange={(event) => setAccent(event.target.value)} value={accent}>
            {ACCENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </SettingsField>
      </div>
      <div className="flex gap-2">
        <button
          className="modal-btn modal-btn--primary"
          onClick={() => { onSave(dept.id, { label, emailLabel, accent }); setEditing(false); }}
          type="button"
        >Uložit</button>
        <button
          className="modal-btn modal-btn--secondary"
          onClick={() => {
            setLabel(dept.label);
            setEmailLabel(dept.emailLabel);
            setAccent(dept.accent);
            setEditing(false);
          }}
          type="button"
        >Zrušit</button>
      </div>
    </div>
  );
});
