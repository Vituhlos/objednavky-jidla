"use client";

import { useState, useTransition } from "react";
import {
  actionAddDepartment,
  actionDeleteDepartment,
  actionReorderDepartments,
  actionUpdateDepartment,
} from "@/app/actions";
import type { DepartmentInfo } from "@/lib/departments";
import MIcon from "../MIcon";
import { ACCENT_OPTIONS } from "./constants";
import { DepartmentRow } from "./DepartmentRow";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/**
 * Správa oddělení. Sedí mimo hlavní formulář, protože se ukládá po jednom
 * a hned — proto se na ně nevztahuje ani lišta neuložených změn.
 *
 * Pořadí se přehazuje optimisticky: seznam se prohodí lokálně a teprve pak se
 * pošle na server. Bez toho by šipka reagovala až po odpovědi a klikání na ni
 * by působilo rozbitě.
 *
 * Mazání je měkké (`active=0`), takže smazané oddělení zůstane vidět
 * v historii. Server odmítne smazat oddělení s dnešní rozpracovanou
 * objednávkou — chyba se ukáže tady.
 */
export function DepartmentsSection({
  initialDepartments,
  isActive,
}: {
  initialDepartments: DepartmentInfo[];
  isActive: boolean;
}) {
  const [departments, setDepartments] = useState<DepartmentInfo[]>(initialDepartments);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDeptSave = (id: number, data: Partial<{ label: string; emailLabel: string; accent: string }>) => {
    startTransition(async () => {
      const updated = await actionUpdateDepartment(id, data);
      setDepartments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    });
  };

  const handleDeptDelete = (id: number) => {
    setDeptError(null);
    startTransition(async () => {
      try {
        await actionDeleteDepartment(id);
        setDepartments((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        setDeptError(err instanceof Error ? err.message : "Chyba při mazání.");
      }
    });
  };

  const handleDeptMove = (id: number, direction: "up" | "down") => {
    const idx = departments.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= departments.length) return;
    const next = [...departments];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDepartments(next);
    startTransition(async () => { await actionReorderDepartments(next.map((d) => d.id)); });
  };

  const handleAddDept = () => {
    if (!newDeptName.trim() || !newDeptLabel.trim()) return;
    setDeptError(null);
    startTransition(async () => {
      try {
        const dept = await actionAddDepartment({
          name: newDeptName.trim(),
          label: newDeptLabel.trim(),
          emailLabel: newDeptLabel.trim(),
          accent: newDeptAccent,
        });
        setDepartments((prev) => [...prev, dept]);
        setNewDeptName("");
        setNewDeptLabel("");
        setNewDeptAccent("blue");
        setShowAddDept(false);
      } catch (err) {
        setDeptError(err instanceof Error ? err.message : "Chyba při přidávání.");
      }
    });
  };

  if (!isActive) return null;

  return (
    <SettingsSection icon="groups" title="Oddělení">
      <p className="text-[12.5px] text-stone-500">
        Správa oddělení zobrazovaných v objednávkovém formuláři. Změny se projeví okamžitě.
      </p>
      {deptError && (
        <p className="text-[12px] text-red-500">{deptError}</p>
      )}
      <div className="flex flex-col gap-2">
        {departments.map((dept, idx) => (
          <DepartmentRow
            dept={dept}
            isFirst={idx === 0}
            isLast={idx === departments.length - 1}
            key={dept.id}
            onDelete={handleDeptDelete}
            onMoveDown={(id) => handleDeptMove(id, "down")}
            onMoveUp={(id) => handleDeptMove(id, "up")}
            onSave={handleDeptSave}
          />
        ))}
      </div>
      {showAddDept ? (
        <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SettingsField hint="interní klíč (nelze měnit)" label="Kód oddělení">
              <input className="modal-input" onChange={(e) => setNewDeptName(e.target.value)} placeholder="např. Sklad" value={newDeptName} />
            </SettingsField>
            <SettingsField hint="zobrazovaný název" label="Název">
              <input className="modal-input" onChange={(e) => setNewDeptLabel(e.target.value)} placeholder="např. Sklad" value={newDeptLabel} />
            </SettingsField>
            <SettingsField label="Barva">
              <select className="k-select" onChange={(e) => setNewDeptAccent(e.target.value)} value={newDeptAccent}>
                {ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </SettingsField>
          </div>
          <div className="flex gap-2">
            <button
              className="modal-btn modal-btn--primary"
              disabled={isPending || !newDeptName.trim() || !newDeptLabel.trim()}
              onClick={handleAddDept}
              type="button"
            >Přidat</button>
            <button
              className="modal-btn modal-btn--secondary"
              onClick={() => { setShowAddDept(false); setNewDeptName(""); setNewDeptLabel(""); }}
              type="button"
            >Zrušit</button>
          </div>
        </div>
      ) : (
        <button
          className="self-start inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-stone-600"
          onClick={() => setShowAddDept(true)}
          type="button"
        >
          <MIcon name="add" size={14} /> Přidat oddělení
        </button>
      )}
    </SettingsSection>
  );
}
