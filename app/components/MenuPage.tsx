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
import { ConfirmModal } from "./ConfirmModal";

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
  hasPdfCurrent: boolean;
  hasPdfNext: boolean;
}

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult; targetWeekStart: string; targetLabel: string; tmpPdfName?: string }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Preview table (import panel) ──────────────────────────────────────────────

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
  const [activeDay, setActiveDay] = useState<string>(() => {
    if (todayCode && menu[todayCode]) return todayCode;
    return days[0] ?? DAY_ORDER[0];
  });

  if (days.length === 0) {
    return <p className="v2-empty-state">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Day tab bar — visible on mobile only (hidden by CSS at ≥768px) */}
      <div className="menu-day-tabs">
        {days.map((day) => (
          <button
            className={[
              "menu-day-tab",
              day === activeDay ? "menu-day-tab--active" : "",
              day === todayCode ? "menu-day-tab--today" : "",
            ].filter(Boolean).join(" ")}
            key={day}
            onClick={() => setActiveDay(day)}
            type="button"
          >
            {day}
          </button>
        ))}
      </div>
      <div className="v2-menu-body">
        <div className="menu-preview-grid">
          {days.map((day) => (
            <div
              className={[
                "menu-day-col",
                day === todayCode ? "menu-day-col--today" : "",
                day !== activeDay ? "menu-day-col--hidden-mobile" : "",
              ].filter(Boolean).join(" ")}
              key={day}
            >
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
      </div>
    </>
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
  hasPdfCurrent,
  hasPdfNext,
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  const [activeWeek, setActiveWeek] = useState<"current" | "next">("current");
  const [editMode, setEditMode] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteNext, setConfirmDeleteNext] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hasNextWeek = Object.keys(initialNextMenu).length > 0;
  const activeWeekStart = activeWeek === "current" ? currentWeekStart : nextWeekStart;
  const activeWeekLabel = activeWeek === "current" ? currentWeekLabel : nextWeekLabel;
  const hasPdfActive = activeWeek === "current" ? hasPdfCurrent : hasPdfNext;

  const handleWeekSwitch = (week: "current" | "next") => {
    setActiveWeek(week);
    if (week === "next" && editMode) setEditMode(false);
    setConfirmDeleteNext(false);
  };

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
      let targetWeekStart: string;
      let targetLabel: string;
      if (detectedStart === nextWeekStart) {
        targetWeekStart = nextWeekStart;
        targetLabel = `příští týden${nextWeekLabel ? ` (${nextWeekLabel})` : ""}`;
      } else if (detectedStart && detectedStart !== currentWeekStart) {
        targetWeekStart = detectedStart;
        targetLabel = data.weekLabel ?? detectedStart;
      } else {
        targetWeekStart = currentWeekStart;
        targetLabel = `aktuální týden${currentWeekLabel ? ` (${currentWeekLabel})` : ""}`;
      }
      setImportState({ phase: "preview", result: data, targetWeekStart, targetLabel, tmpPdfName: data.tmpPdfName });
    } catch {
      setImportState({ phase: "error", message: "Síťová chyba. Zkuste to znovu." });
    }
  }, [currentWeekStart, currentWeekLabel, nextWeekStart, nextWeekLabel]);

  const handleConfirm = () => {
    if (importState.phase !== "preview") return;
    const { result, targetWeekStart, tmpPdfName } = importState;
    setImportState({ phase: "saving" });
    startTransition(async () => {
      const label = result.weekLabel ?? targetWeekStart;
      await actionConfirmMenuImport(targetWeekStart, label, result.items, tmpPdfName);
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
    setConfirmDeleteNext(false);
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
          {activeWeekLabel && (
            <span className="v2-fact">
              <strong className="v2-accent">{activeWeekLabel}</strong>
            </span>
          )}
        </div>
        <div className="v2-infostrip__send">
          {activeWeek === "current" && (
            <button
              className={`v2-btn ${editMode ? "v2-btn--primary" : "v2-btn--secondary"}`}
              onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
              type="button"
            >
              {editMode ? "Zavřít úpravu" : "Upravit ručně"}
            </button>
          )}
          <button
            className="v2-btn v2-btn--primary"
            onClick={() => {
              setEditMode(false);
              setImportState({ phase: "uploading" });
            }}
            type="button"
          >
            Importovat PDF
          </button>
        </div>
      </div>

      {/* ── Import modal ── */}
      {isImportOpen && (
        <div className="modal-overlay" onClick={() => setImportState({ phase: "idle" })}>
          <div
            className={`modal-sheet${importState.phase === "preview" ? " modal-sheet--wide" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__header">
              <h3 className="modal-sheet__title">
                {importState.phase === "preview" ? "Náhled importu" : "Importovat PDF jídelníčku"}
              </h3>
              <button aria-label="Zavřít" className="modal-close-btn" onClick={() => setImportState({ phase: "idle" })} type="button">×</button>
            </div>
            <div className="modal-sheet__body">
              {importState.phase === "uploading" && (
                <>
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                    <span className="import-status" style={{ margin: 0 }}>
                      Rozpoznáno <strong>{importState.result.items.length}</strong> položek
                      {importState.result.weekLabel && <>, týden <strong>{importState.result.weekLabel}</strong></>}
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.83rem", color: "var(--v2-text-muted)", alignSelf: "center" }}>Uložit jako:</span>
                      <button
                        className={`v2-btn ${importState.targetWeekStart === currentWeekStart ? "v2-btn--primary" : "v2-btn--secondary"}`}
                        onClick={() => setImportState((prev) => prev.phase === "preview" ? { ...prev, targetWeekStart: currentWeekStart, targetLabel: `aktuální týden${currentWeekLabel ? ` (${currentWeekLabel})` : ""}` } : prev)}
                        type="button"
                      >
                        Aktuální týden
                      </button>
                      <button
                        className={`v2-btn ${importState.targetWeekStart === nextWeekStart ? "v2-btn--primary" : "v2-btn--secondary"}`}
                        onClick={() => setImportState((prev) => prev.phase === "preview" ? { ...prev, targetWeekStart: nextWeekStart, targetLabel: `příští týden${nextWeekLabel ? ` (${nextWeekLabel})` : ""}` } : prev)}
                        type="button"
                      >
                        Příští týden
                      </button>
                    </span>
                  </div>
                  <PreviewTable items={importState.result.items} />
                </>
              )}
              {importState.phase === "saving" && <p className="import-status">Ukládám jídelníček...</p>}
            </div>
            {importState.phase === "preview" && (
              <div className="modal-sheet__footer">
                <button className="modal-btn modal-btn--secondary" onClick={() => setImportState({ phase: "idle" })} type="button">Zrušit</button>
                <button className="modal-btn modal-btn--primary" disabled={isPending} onClick={handleConfirm} type="button">
                  {isPending ? "Ukládám..." : "Uložit jídelníček"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <main className="v2-content">
        <section className="v2-dept">
          {/* Card header */}
          <div className="v2-dept__head">
            <div>
              <h2 className="v2-dept__title">Jídelníček</h2>
              <span className="v2-dept__count">
                {activeWeekLabel ?? "Jídelníček není naplněný"}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {hasPdfActive && (
                <a
                  className="v2-btn v2-btn--secondary"
                  download
                  href={`/api/menu/pdf/${activeWeekStart}`}
                  style={{ fontSize: "0.8rem" }}
                >
                  ↓ PDF
                </a>
              )}
              {activeWeek === "next" && hasNextWeek && (
                <button
                  className="v2-btn v2-btn--danger"
                  disabled={isPending}
                  onClick={() => setConfirmDeleteNext(true)}
                  type="button"
                >
                  Smazat
                </button>
              )}
              {confirmDeleteNext && (
                <ConfirmModal
                  confirmLabel="Smazat"
                  isPending={isPending}
                  message="Celý jídelníček příštího týdne bude trvale odstraněn."
                  onClose={() => setConfirmDeleteNext(false)}
                  onConfirm={handleDeleteNextWeek}
                  title="Smazat příští týden"
                />
              )}
            </div>
          </div>

          {/* Week tab bar */}
          <div className="menu-week-tabs">
            <button
              className={`menu-week-tab${activeWeek === "current" ? " menu-week-tab--active" : ""}`}
              onClick={() => handleWeekSwitch("current")}
              type="button"
            >
              Aktuální týden
            </button>
            <button
              className={`menu-week-tab${activeWeek === "next" ? " menu-week-tab--active" : ""}`}
              onClick={() => handleWeekSwitch("next")}
              type="button"
            >
              Příští týden
            </button>
          </div>

          {/* Content area */}
          {activeWeek === "current" && editMode ? (
            <div style={{ padding: "0.75rem 1.25rem 1.25rem", overflowX: "auto" }}>
              <EditGrid
                disabled={isPending}
                menu={currentMenu}
                onAdd={handleAdd}
                onDelete={(id) => setConfirmDeleteItemId(id)}
                onUpdate={handleUpdate}
                todayCode={todayCode}
              />
              {confirmDeleteItemId !== null && (
                <ConfirmModal
                  message="Tato položka jídelníčku bude trvale odstraněna."
                  onClose={() => setConfirmDeleteItemId(null)}
                  onConfirm={() => { handleDelete(confirmDeleteItemId); setConfirmDeleteItemId(null); }}
                  title="Smazat položku"
                />
              )}
            </div>
          ) : activeWeek === "current" ? (
            <ViewGrid
              emptyMessage="Jídelníček není naplněný. Importujte PDF nebo použijte ruční úpravu."
              menu={currentMenu}
              todayCode={todayCode}
            />
          ) : (
            <ViewGrid
              emptyMessage="Zatím žádný jídelníček. Importujte PDF příštího týdne — app ho automaticky uloží sem."
              menu={initialNextMenu}
              todayCode={null}
            />
          )}
        </section>
      </main>
    </div>
  );
}
