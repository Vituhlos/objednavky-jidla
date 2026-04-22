"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import type { MenuItem } from "@/lib/types";
import type { ParsedMenuItem, ParseResult } from "@/lib/parse-menu";
import {
  actionConfirmMenuImport,
  actionAddMenuItem,
  actionUpdateMenuItem,
  actionDeleteMenuItem,
} from "@/app/actions";
import { useRouter } from "next/navigation";
import AppSidebar from "./AppSidebar";

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"];
const DAY_LABELS: Record<string, string> = {
  Po: "Pondělí", Út: "Úterý", St: "Středa", Čt: "Čtvrtek", Pá: "Pátek",
};

interface Props {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  weekLabel: string | null;
  todayCode: string | null;
}

type ImportState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; result: ParseResult }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Preview table (import) ────────────────────────────────────────────────────

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

// ── Single editable menu item row ─────────────────────────────────────────────

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
        className="row-delete-btn"
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

// ── Menu grid – view mode ─────────────────────────────────────────────────────

function ViewGrid({
  menu,
  todayCode,
}: {
  menu: Record<string, { soups: MenuItem[]; meals: MenuItem[] }>;
  todayCode: string | null;
}) {
  const days = DAY_ORDER.filter((d) => menu[d]);
  if (days.length === 0) {
    return <p className="menu-empty">Jídelníček není naplněný. Importujte PDF nebo použijte ruční úpravu.</p>;
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

// ── Menu grid – edit mode ─────────────────────────────────────────────────────

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

export default function MenuPage({ menu: initialMenu, weekLabel, todayCode }: Props) {
  const [menu, setMenu] = useState(initialMenu);
  const [editMode, setEditMode] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ── Import handlers ───────────────────────────────────────────────────────

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
      const data = await res.json();
      if (!res.ok) { setImportState({ phase: "error", message: data.error ?? "Neznámá chyba." }); return; }
      setImportState({ phase: "preview", result: data as ParseResult });
    } catch {
      setImportState({ phase: "error", message: "Síťová chyba. Zkuste to znovu." });
    }
  }, []);

  const handleConfirm = () => {
    if (importState.phase !== "preview") return;
    const { result } = importState;
    setImportState({ phase: "saving" });
    startTransition(async () => {
      await actionConfirmMenuImport(result.weekLabel ?? weekLabel ?? "neznámý týden", result.items);
      setImportState({ phase: "done" });
      router.refresh();
    });
  };

  // ── Edit mode handlers ────────────────────────────────────────────────────

  const handleUpdate = useCallback((id: number, updates: Partial<{ code: string; name: string; price: number }>) => {
    setMenu((prev) => {
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
      setMenu((prev) => {
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
      });
      setMenu((prev) => {
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
  }, []);

  const isImportOpen = importState.phase !== "idle" && importState.phase !== "done";

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-stage">
        <header className="hero">
          <div className="hero__topline">
            <span>Jídelníček LIMA</span>
          </div>
          <div className="hero__content">
            <div>
              <p className="hero__eyebrow">Správa jídelníčku</p>
              <h2>Jídelníček LIMA</h2>
              <p className="hero__description">
                {weekLabel ? `Aktuální týden: ${weekLabel}` : "Jídelníček není naplněný. Importujte PDF nebo přidejte položky ručně."}
              </p>
            </div>
            <div className="hero__actions">
              <div className="hero__button-row">
                <button
                  className={`header-action ${editMode ? "header-action--primary" : "header-action--secondary"}`}
                  onClick={() => { setEditMode((v) => !v); setImportState({ phase: "idle" }); }}
                  type="button"
                >
                  {editMode ? "Zavřít úpravu" : "Upravit ručně"}
                </button>
                <button
                  className="header-action header-action--primary"
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
          </div>
        </header>

        {/* ── Import panel ─────────────────────────── */}
        {isImportOpen && (
          <div className="import-panel">
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
                      </p>
                    </div>
                    <div className="import-panel__preview-actions">
                      <button className="header-action header-action--secondary" onClick={() => setImportState({ phase: "idle" })} type="button">Zrušit</button>
                      <button className="header-action header-action--primary" disabled={isPending} onClick={handleConfirm} type="button">
                        {isPending ? "Ukládám..." : "Nahradit aktuální jídelníček"}
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

        {/* ── Menu grid ────────────────────────────── */}
        <div className="menu-section">
          {editMode ? (
            <EditGrid
              disabled={isPending}
              menu={menu}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              todayCode={todayCode}
            />
          ) : (
            <ViewGrid menu={menu} todayCode={todayCode} />
          )}
        </div>
      </section>
    </main>
  );
}
