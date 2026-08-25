"use client";

import { useEffect, useState, useTransition } from "react";
import {
  actionGetPeople,
  actionMergePeople,
  actionRenamePerson,
  actionSetPersonActive,
} from "@/app/actions";
import type { Person } from "@/lib/people";
import { ConfirmModal } from "../ConfirmModal";
import MIcon from "../MIcon";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/**
 * Správa strávníků — lidí, na které se věší objednávky.
 *
 * Duplicity vznikají přirozeně: překlep ve jméně nebo přechod mezi odděleními
 * založí dalšího strávníka. Sloučení je proto běžný úkon, ne výjimka. Jde ale
 * vždycky jen jedním směrem — historie se přesune do vybraného člověka
 * a zdrojový záznam zmizí.
 *
 * Strávník s objednávkami se nemaže, jen deaktivuje. Jinak by z historie
 * mizeli lidé a součty za minulé měsíce by přestaly sedět.
 */
export function PeopleSection({ isActive }: { isActive: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [mergeSource, setMergeSource] = useState<Person | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (loaded) return;
    actionGetPeople()
      .then((list) => { setPeople(list); setLoaded(true); })
      .catch(() => setError("Strávníky se nepodařilo načíst."));
  }, [loaded]);

  const reload = () => actionGetPeople().then(setPeople).catch(() => {});

  const handleRename = (id: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await actionRenamePerson(id, draftName);
        setEditingId(null);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Přejmenování se nepodařilo.");
      }
    });
  };

  const handleToggleActive = (person: Person) => {
    setError(null);
    startTransition(async () => {
      try {
        await actionSetPersonActive(person.id, !person.active);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Změna se nepodařila.");
      }
    });
  };

  const handleMerge = () => {
    if (!mergeSource || !mergeTargetId) return;
    setError(null);
    startTransition(async () => {
      try {
        await actionMergePeople(mergeSource.id, Number(mergeTargetId));
        setConfirmMerge(false);
        setMergeSource(null);
        setMergeTargetId("");
        await reload();
      } catch (err) {
        setConfirmMerge(false);
        setError(err instanceof Error ? err.message : "Sloučení se nepodařilo.");
      }
    });
  };

  if (!isActive) return null;

  const mergeTarget = people.find((p) => p.id === Number(mergeTargetId)) ?? null;

  return (
    <SettingsSection icon="badge" title={`Strávníci${people.length > 0 ? ` (${people.length})` : ""}`}>
      <p className="text-[12.5px] text-stone-500">
        Lidé, na které se věší objednávky. Vznikají sami z vyplněných jmen — překlep nebo
        přechod mezi odděleními proto může založit duplicitu, kterou tady sloučíš.
      </p>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      {!loaded ? (
        <p className="text-[12.5px] text-stone-400">Načítám…</p>
      ) : people.length === 0 ? (
        <p className="text-[12.5px] text-stone-400">Zatím nikdo — strávníci vzniknou s první objednávkou.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {people.map((person) => (
            <div
              className={`glass-soft rounded-2xl px-3 py-2.5 flex items-center gap-3 ${person.active ? "" : "opacity-55"}`}
              key={person.id}
            >
              {editingId === person.id ? (
                <>
                  <input
                    autoFocus
                    className="modal-input flex-1"
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(person.id); }}
                    value={draftName}
                  />
                  <button
                    className="modal-btn modal-btn--primary shrink-0"
                    disabled={isPending || !draftName.trim()}
                    onClick={() => handleRename(person.id)}
                    type="button"
                  >Uložit</button>
                  <button
                    className="modal-btn modal-btn--secondary shrink-0"
                    onClick={() => setEditingId(null)}
                    type="button"
                  >Zrušit</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-stone-800 truncate">
                      {person.name}
                      {person.guestOfName && (
                        <span className="ml-1.5 text-[11px] font-normal text-stone-500">
                          host: {person.guestOfName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {person.departmentName ?? "bez oddělení"}
                      {person.orderCount > 0 && <> · {person.orderCount} objednávek</>}
                      {person.lastOrderDate && <> · naposledy {person.lastOrderDate}</>}
                      {!person.active && <> · neaktivní</>}
                    </div>
                  </div>
                  <button
                    aria-label={`Přejmenovat ${person.name}`}
                    className="modal-btn modal-btn--secondary shrink-0"
                    onClick={() => { setEditingId(person.id); setDraftName(person.name); }}
                    type="button"
                  >Přejmenovat</button>
                  <button
                    aria-label={`Sloučit ${person.name} s jiným strávníkem`}
                    className="modal-btn modal-btn--secondary shrink-0"
                    disabled={people.length < 2}
                    onClick={() => { setMergeSource(person); setMergeTargetId(""); }}
                    type="button"
                  >Sloučit</button>
                  <button
                    aria-label={person.active ? `Deaktivovat ${person.name}` : `Aktivovat ${person.name}`}
                    className="modal-btn modal-btn--secondary shrink-0"
                    disabled={isPending}
                    onClick={() => handleToggleActive(person)}
                    type="button"
                  >{person.active ? "Deaktivovat" : "Aktivovat"}</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {mergeSource && (
        <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2">
          <p className="text-[12.5px] text-stone-700">
            Historii strávníka <strong>{mergeSource.name}</strong>
            {mergeSource.orderCount > 0 && <> ({mergeSource.orderCount} objednávek)</>} přesunout do:
          </p>
          <SettingsField hint="zdrojový záznam po sloučení zmizí" label="Cílový strávník">
            <select
              className="k-select"
              onChange={(e) => setMergeTargetId(e.target.value)}
              value={mergeTargetId}
            >
              <option value="">— vyber —</option>
              {people
                .filter((p) => p.id !== mergeSource.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.departmentName ? ` · ${p.departmentName}` : ""}
                  </option>
                ))}
            </select>
          </SettingsField>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <MIcon name="warning" size={14} style={{ color: "#D97706", flexShrink: 0 }} />
            <span className="text-stone-600">
              Slučuj jen tehdy, když jde opravdu o téhož člověka. Dva různí lidé se stejným
              jménem se sloučit nesmí — zpět už to nejde.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="modal-btn modal-btn--primary"
              disabled={isPending || !mergeTargetId}
              onClick={() => setConfirmMerge(true)}
              type="button"
            >Sloučit</button>
            <button
              className="modal-btn modal-btn--secondary"
              onClick={() => { setMergeSource(null); setMergeTargetId(""); }}
              type="button"
            >Zrušit</button>
          </div>
        </div>
      )}

      {confirmMerge && mergeSource && mergeTarget && (
        <ConfirmModal
          confirmLabel="Sloučit"
          isPending={isPending}
          message={`„${mergeSource.name}“ zmizí a jeho ${mergeSource.orderCount} objednávek se přesune pod „${mergeTarget.name}“. Tuto akci nelze vrátit.`}
          onClose={() => setConfirmMerge(false)}
          onConfirm={handleMerge}
          title="Sloučit strávníky"
        />
      )}
    </SettingsSection>
  );
}
