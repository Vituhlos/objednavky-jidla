"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MIcon from "../MIcon";
import { useIsMobile } from "./use-media";

export function MenuSelect({
  id, value, onChange, options, placeholder, style,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: import("@/lib/types").MenuItem[];
  placeholder: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hlIdx, setHlIdx] = useState(0);
  const isMobile = useIsMobile();

  const allCount = options.length + 1;
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  // ── všechny hooky musí být před jakýmkoliv conditional return ──

  const openList = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const listH = Math.min(allCount * 38 + 8, 264);
    const above = window.innerHeight - rect.bottom < listH && rect.top > listH;
    setDropPos({ top: above ? rect.top - listH - 4 : rect.bottom + 4, left: rect.left, width: rect.width });
    const idx = value === null ? 0 : (options.findIndex((o) => o.id === value) + 1);
    setHlIdx(idx < 0 ? 0 : idx);
    setOpen(true);
  }, [allCount, options, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelectorAll<HTMLElement>("[data-idx]")[hlIdx]?.scrollIntoView({ block: "nearest" });
  }, [hlIdx, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHlIdx((i) => Math.min(i + 1, allCount - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHlIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (hlIdx === 0) onChange(null); else onChange(options[hlIdx - 1].id);
      setOpen(false); triggerRef.current?.focus();
    }
  };

  const select = (v: number | null) => { onChange(v); setOpen(false); triggerRef.current?.focus(); };

  const selectedOpt = value !== null ? options.find((o) => o.id === value) : null;

  if (isMobile) {
    return (
      <select
        id={id}
        className="modal-select"
        style={style}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.code ? `${o.code} – ${o.name}` : o.name}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        id={id} type="button" role="combobox" aria-controls={listboxId} aria-expanded={open} aria-haspopup="listbox"
        className="modal-select"
        style={{ display: "flex", alignItems: "center", backgroundImage: "none", textAlign: "left", cursor: "default", ...style }}
        onClick={openList} onKeyDown={handleKeyDown} ref={triggerRef}
      >
        <span className="flex-1 truncate min-w-0 flex items-baseline gap-1.5">
          {selectedOpt ? (
            <>
              {selectedOpt.code && <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#d97706", flexShrink: 0 }}>{selectedOpt.code}</span>}
              <span className="truncate">{selectedOpt.name}</span>
            </>
          ) : (
            <span style={{ color: "#a8a29e" }}>{placeholder}</span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9b8474" strokeWidth="2" aria-hidden
          style={{ flexShrink: 0, marginLeft: 4, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "" }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && createPortal(
        <div
          id={listboxId} ref={listRef} role="listbox"
          style={{
            position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999,
            background: "rgba(255,255,255,0.92)", backdropFilter: "blur(32px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.68)", borderRadius: 16,
            boxShadow: "0 1px 0 rgba(255,255,255,0.85) inset, 0 12px 40px -6px rgba(26,18,8,0.16), 0 2px 8px -2px rgba(26,18,8,0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 264, overflowY: "auto", padding: "4px 0" }}>
            <button data-idx="0" type="button" role="option" aria-selected={value === null}
              className="dropdown-item dropdown-item--placeholder"
              data-hl={String(hlIdx === 0)}
              onClick={() => select(null)}
            >{placeholder}</button>
            {options.map((opt, i) => {
              const idx = i + 1;
              return (
                <button key={opt.id} data-idx={String(idx)} type="button" role="option" aria-selected={value === opt.id}
                  className="dropdown-item"
                  data-hl={String(hlIdx === idx)}
                  onClick={() => select(opt.id)}
                >
                  {opt.code && <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#d97706", minWidth: "1.5rem", textAlign: "right", flexShrink: 0 }}>{opt.code}</span>}
                  <span style={{ flex: 1 }}>{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
