"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import type { MenuItem } from "@/lib/types";
import type { ParsedMenuItem, ParseResult } from "@/lib/parse-menu";
import {
  actionConfirmMenuImport,
  actionDeleteMenuWeek,
  actionAddMenuItem,
  actionUpdateMenuItem,
  actionDeleteMenuItem,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import AppTopBar from "./AppTopBar";

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"];
const DAY_LABELS: Record<string, string> = {
  Po: "Pondělí", Út: "Úterý", St: "Středa", Čt: "Čtvrtek", Pá: "Pátek",
};

interface Props {
  currentMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  currentWeekLabel: string | null;
  currentWeekStart: string;
  nextMenu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  nextWeekLabel: string | null;
  nextWeekStart: string;
  todayCode: string | null;
}

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult; targetWeekStart: string; targetLabel: string }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ items }: { items: ParsedMenuItem[] }) {
  const byDay: Record<string, { soups: ParsedMenuItem[]; meals: ParsedMenuItem[] }> = {};
  for (const item of items) {
    if (!byDay[item.day]) byDay[item.day] = { soups: [], meals: [] };
    if (item.type === "Polévka") byDay[item.day].soups.push(item);
    else byDay[item.day].meals.push(item);
  }
  return (
    <div className="menu-preview-grid">
      {DAY_ORDER.filter((d) => byDay[d]).map((day) => (
        <div className="menu-day-col" key={day}>
          <h4 className="menu-day-col__header">{DAY_LABELS[day]}</h4>
          {byDay[day].soups.length > 0 && (
            <div className="menu-day-col__section">
              <p className="menu-day-col__section-label">Polévky</p>
              {byDay[day].soups.map((s, i) => (
                <p className="menu-day-col__item menu-day-col__item--soup" key={i}>
                  <span className="menu-item-code">{s.code}</span> {s.name}
                </p>
              ))}
            </div>
          )}
          {byDay[day].meals.length > 0 && (
            <div className="menu-day-col__section">
              <p className="menu-day-col__section-label">Jídla</p>
              {byDay[day].meals.map((m, i) => (
                <p className="menu-day-col__item" key={i}>
                  <span className="menu-item-code">{m.code}</span> {m.name}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Editable item row ─────────────────────────────────────────────────────────

function EditableItem({
  item,
  disabled,
  onUpdate,
  onDelete,
}: {
  item: MenuItem;
  disabled: boolean;
  onUpdate: (id: number, updates: Partial<{ code: string; name: string; price: number }>) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="menu-edit-row">
      <input
        className="menu-edit-code"
        defaultValue={item.code}
        disabled={disabled}
        onBlur={(e) => { if (e.target.value !== item.code) onUpdate(item.id, { code: e.target.value }); }}
        title="Kód"
      />
      <input
        className="menu-edit-name"
        defaultValue={item.name}
        disabled={disabled}
        onBlur={(e) => { if (e.target.value !== item.name) onUpdate(item.id, { name: e.target.value }); }}
        title="Název"
      />
      <input
        className="menu-edit-price"
        defaultValue={item.price}
        disabled={disabled}
        min={0}
        onBlur={(e) => {
          const p = Number(e.target.value);
          if (!isNaN(p) && p !== item.price) onUpdate(item.id, { price: p });
        }}
        title="Cena Kč"
        type="number"
      />
      <button
        className="v2-delete-btn"
        disabled={disabled}
        onClick={() => onDelete(item.id)}
        title="Smazat"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

// ── View grid ─────────────────────────────────────────────────────────────────

function ViewGrid({
  menu,
  todayCode,
  emptyMessage,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  todayCode: string | null;
  emptyMessage: string;
}) {
  const days = DAY_ORDER.filter((d) => menu[d]);
  if (days.length === 0) {
    return <p className="v2-empty-state">{emptyMessage}</p>;
  }
  return (
    <div className="menu-preview-grid">
      {days.map((day) => (
        <div className={`menu-day-col${day === todayCode ? " menu-day-col--today" : ""}`} key={day}>
          <h4 className="menu-day-col__header">
            {DAY_LABELS[day]}
            {day === todayCode && <span className="menu-day-col__today-badge">Dnes</span>}
          </h4>
          {menu[day].soups.length > 0 && (
            <div className="menu-day-col__section">
              <p className="menu-day-col__section-label">Polévky</p>
              {menu[day].soups.map((s) => (
                <p className="menu-day-col__item menu-day-col__item--soup" key={s.id}>
                  <span className="menu-item-code">{s.code}</span> {s.name}
                </p>
              ))}
            </div>
          )}
          {menu[day].meals.length > 0 && (
            <div className="menu-day-col__section">
              <p className="menu-day-col__section-label">Jídla</p>
              {menu[day].meals.map((m) => (
                <p className="menu-day-col__item" key={m.id}>
                  <span className="menu-item-code">{m.code}</span> {m.name}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Edit grid ─────────────────────────────────────────────────────────────────

function EditGrid({
  menu,
  todayCode,
  disabled,
  onUpdate,
  onDelete,
  onAdd,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  todayCode: string | null;
  disabled: boolean;
  onUpdate: (id: number, updates: Partial<{ code: string; name: string; price: number }>) => void;
  onDelete: (id: number) => void;
  onAdd: (day: string, type: "Polévka" | "Jídlo") => void;
}) {
  return (
    <div className="menu-edit-grid">
      {DAY_ORDER.map((day) => {
        const dayData = menu[day] ?? { soups: [], meals: [] };
        return (
          <div className={`menu-edit-col${day === todayCode ? " menu-edit-col--today" : ""}`} key={day}>
            <div className="menu-edit-col__header">
              <span>{DAY_LABELS[day]}</span>
              {day === todayCode && <span className="menu-day-col__today-badge">Dnes</span>}
            </div>
            <div className="menu-edit-section">
              <div className="menu-edit-section__label">
                <span>Polévky</span>
                <div className="menu-edit-col-head">
                  <span>Kód</span><span>Název</span><span>Kč</span><span></span>
                </div>
              </div>
              {dayData.soups.map((s) => (
                <EditableItem disabled={disabled} item={s} key={s.id} onDelete={onDelete} onUpdate={onUpdate} />
              ))}
              <button className="menu-add-btn" disabled={disabled} onClick={() => onAdd(day, "Polévka")} type="button">
                + Polévka
              </button>
            </div>
            <div className="menu-edit-section">
              <div className="menu-edit-section__label">
                <span>Jídla</span>
                <div className="menu-edit-col-head">
                  <span>Kód</span><span>Název</span><span>Kč</span><span></span>
                </div>
              </div>
              {dayData.meals.map((m) => (
                <EditableItem disabled={disabled} item={m} key={m.id} onDelete={onDelete} onUpdate={onUpdate} />
              ))}
              <button className="menu-add-btn" disabled={disabled} onClick={() => onAdd(day, "Jídlo")} type="button">
                + Jídlo
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuPage({
  currentMenu: initialCurrentMenu,
  currentWeekLabel,
  currentWeekStart,
  nextMenu: initialNextMenu,
  nextWeekLabel,
  nextWeekStart,
  todayCode,
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  const [editMode, setEditMode] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hasNextWeek = Object.keys(initialNextMenu).length > 0;

  // ── Import ────────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setImportState({ phase: "error", message: "Soubor musí být PDF." });
      return;
    }
    setImportState({ phase: "uploading" });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/menu/import", { method: "POST", body: fd });
      const data = await res.json() as ParseResult;
      if (!res.ok) {
        setImportState({ phase: "error", message: (data as { error?: string }).error ?? "Neznámá chyba." });
        return;
      }
      const detectedStart = data.weekStart;
      let targetWeekStart = nextWeekStart;
      let targetLabel = `příští týden${nextWeekLabel ? ` (${nextWeekLabel})` : ""}`;
      if (detectedStart === currentWeekStart) {
        targetWeekStart = currentWeekStart;
        targetLabel = `aktuální týden${currentWeekLabel ? ` (${currentWeekLabel})` : ""}`;
      } else if (detectedStart) {
        targetWeekStart = detectedStart;
        targetLabel = data.weekLabel ?? detectedStart;
      }
      setImportState({ phase: "preview", result: data, targetWeekStart, targetLabel });
    } catch {
      setImportState({ phase: "error", message: "Síťová chyba. Zkuste to znovu." });
    }
  }, [currentWeekStart, currentWeekLabel, nextWeekStart, nextWeekLabel]);

  const handleConfirm = () => {
    if (importState.phase !== "preview") return;
    const { result, targetWeekStart } = importState;
    setImportState({ phase: "saving" });
    startTransition(async () => {
      const label = result.weekLabel ?? targetWeekStart;
      await actionConfirmMenuImport(targetWeekStart, label, result.items);
      setImportState({ phase: "done" });
      router.refresh();
    });
  };

  // ── Edit mode ─────────────────────────────────────────────────────────────

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number }>) => {
    setCurrentMenu((prev) => {
      const next = { ...prev };
      for (const day of Object.keys(next)) {
        next[day] = {
          soups: next[day].soups.map((s) => s.id === id ? { ...s, ...updates } : s),
          meals: next[day].meals.map((m) => m.id === id ? { ...m, ...updates } : m),
        };
      }
      return next;
    });
    startTransition(async () => { await actionUpdateMenuItem(id, updates); });
  }, []);

  const handleDelete = useCallback((id: number) => {
    startTransition(async () => {
      await actionDeleteMenuItem(id);
      setCurrentMenu((prev) => {
        const next = { ...prev };
        for (const day of Object.keys(next)) {
          next[day] = {
            soups: next[day].soups.filter((s) => s.id !== id),
            meals: next[day].meals.filter((m) => m.id !== id),
          };
        }
        return next;
      });
    });
  }, []);

  const handleAdd = useCallback((day: string, type: "Polévka" | "Jídlo") => {
    startTransition(async () => {
      const newItem = await actionAddMenuItem({
        day,
        type,
        code: type === "Polévka" ? "A" : "1",
        name: type === "Polévka" ? "Nová polévka" : "Nové jídlo",
        price: type === "Polévka" ? 35 : 120,
        weekStart: currentWeekStart,
      });
      setCurrentMenu((prev) => {
        const dayData = prev[day] ?? { soups: [], meals: [] };
        return {
          ...prev,
          [day]: {
            soups: type === "Polévka" ? [...dayData.soups, newItem] : dayData.soups,
            meals: type === "Jídlo" ? [...dayData.meals, newItem] : dayData.meals,
          },
        };
      });
    });
  }, [currentWeekStart]);

  const handleDeleteNextWeek = () => {
    startTransition(async () => {
      await actionDeleteMenuWeek(nextWeekStart);
      router.refresh();
    });
  };

  const isImportOpen = importState.phase !== "idle" && importState.phase !== "done";

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Infostrip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>Jídelníček LIMA</span>
          {currentWeekLabel && (
            <span className="v2-fact">
              Aktuální týden: <strong className="v2-accent">{currentWeekLabel}</strong>
            </span>
          )}
        </div>
        <div className="v2-infostrip__send">
          <button
            className={`v2-btn ${editMode ? "v2-btn--primary" : "v2-btn--secondary"}`}
            onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
            type="button"
          >
            {editMode ? "Zavřít úpravu" : "Upravit ručně"}
          </button>
          <button
            className="v2-btn v2-btn--primary"
            onClick={() => {
              setEditMode(false);
              setImportState(isImportOpen ? { phase: "idle" } : { phase: "uploading" });
            }}
            type="button"
          >
            {isImportOpen ? "Zavřít import" : "Importovat PDF"}
          </button>
        </div>
      </div>

      {/* ── Import panel ── */}
      {isImportOpen && (
        <div style={{ background: "var(--v2-card)", borderBottom: "1px solid var(--v2-border)", padding: "1rem 1.25rem" }}>
          <div className="import-panel__inner">
            {importState.phase === "uploading" && (
              <>
                <p className="import-panel__title">Nahrát PDF jídelníčku LIMA</p>
                <div
                  className={`drop-zone${isDragging ? " drop-zone--active" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  <span className="drop-zone__icon">PDF</span>
                  <p>Přetáhněte PDF sem nebo klikněte pro výběr souboru</p>
                  <input accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} ref={fileInputRef} style={{ display: "none" }} type="file" />
                </div>
                <p className="import-status">Čekám na soubor...</p>
              </>
            )}
            {importState.phase === "error" && (
              <div className="import-error">
                <strong>Chyba:</strong> {importState.message}
                <button className="import-retry-btn" onClick={() => setImportState({ phase: "uploading" })} type="button">Zkusit znovu</button>
              </div>
            )}
            {importState.phase === "preview" && (
              <>
                <div className="import-panel__preview-header">
                  <div>
                    <p className="import-panel__title">Náhled rozpoznaných položek</p>
                    <p className="import-status">
                      Rozpoznáno <strong>{importState.result.items.length}</strong> položek
                      {importState.result.weekLabel && <>, týden <strong>{importState.result.weekLabel}</strong></>}
                      {" · "}Bude uloženo jako: <strong>{importState.targetLabel}</strong>
                    </p>
                  </div>
                  <div className="import-panel__preview-actions">
                    <button className="v2-btn v2-btn--secondary" onClick={() => setImportState({ phase: "idle" })} type="button">Zrušit</button>
                    <button className="v2-btn v2-btn--primary" disabled={isPending} onClick={handleConfirm} type="button">
                      {isPending ? "Ukládám..." : "Uložit jídelníček"}
                    </button>
                  </div>
                </div>
                <PreviewTable items={importState.result.items} />
              </>
            )}
            {importState.phase === "saving" && <p className="import-status">Ukládám jídelníček...</p>}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <main className="v2-content">
        {/* Current week */}
        <section className="v2-dept">
          <div className="v2-dept__head">
            <div className="v2-dept__info">
              <div>
                <h2 className="v2-dept__title">Aktuální týden</h2>
                {currentWeekLabel
                  ? <span className="v2-dept__count">{currentWeekLabel}</span>
                  : <span className="v2-dept__count">Jídelníček není naplněný</span>
                }
              </div>
            </div>
          </div>
          <div className="v2-menu-body">
            {editMode ? (
              <EditGrid
                disabled={isPending}
                menu={currentMenu}
                onAdd={handleAdd}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                todayCode={todayCode}
              />
            ) : (
              <ViewGrid
                emptyMessage="Jídelníček není naplněný. Importujte PDF nebo použijte ruční úpravu."
                menu={currentMenu}
                todayCode={todayCode}
              />
            )}
          </div>
        </section>

        {/* Next week */}
        <section className="v2-dept">
          <div className="v2-dept__head">
            <div className="v2-dept__info">
              <div>
                <h2 className="v2-dept__title">Příští týden</h2>
                {nextWeekLabel
                  ? <span className="v2-dept__count">{nextWeekLabel}</span>
                  : <span className="v2-dept__count">Připraveno dopředu</span>
                }
              </div>
            </div>
            {hasNextWeek && (
              <button
                className="v2-btn v2-btn--danger"
                disabled={isPending}
                onClick={handleDeleteNextWeek}
                type="button"
              >
                Smazat
              </button>
            )}
          </div>
          <div className="v2-menu-body">
            <ViewGrid
              emptyMessage="Zatím žádný jídelníček. Importujte PDF příštího týdne — app ho automaticky uloží sem."
              menu={initialNextMenu}
              todayCode={null}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
