"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLOSURE_ICON_GROUPS, ALL_CLOSURE_ICONS, DEFAULT_CLOSURE_ICON } from "@/lib/closure-icons";
import MIcon from "./MIcon";

// Popover emoji picker: search on top, grid in the middle, category icons in a
// footer strip. Categories sit at the bottom as icons rather than as text chips on
// top — the grid is what the eye works with, so it gets the width, and the row of
// small pictures reads as a switch rather than as content.
//
// Two data sources on purpose:
//   • the built-in set carries Czech keywords, so "dovolená" or "klíč" find things
//   • public/emoji.json (generated from emojibase) adds the full ~1900, searchable
//     in English because emojibase ships no Czech locale
// The big file is fetched the first time the picker opens, never in the page bundle.

interface RemoteEmoji { c: string; l: string; g: number; t: string }
interface EmojiPayload { groups: Record<string, string>; count: number; emoji: RemoteEmoji[] }

let cachedPayload: EmojiPayload | null = null;

// One glyph per category for the footer strip, in payload group order
const GROUP_GLYPH: Record<string, string> = {
  doporucene: "⭐", "0": "🙂", "1": "✋", "3": "🐶", "4": "🍎",
  "5": "🚗", "6": "⚽", "7": "💡", "8": "🔣", "9": "🏳️",
};

export function EmojiPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("doporucene");
  const [payload, setPayload] = useState<EmojiPayload | null>(cachedPayload);
  const [loadFailed, setLoadFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const PANEL_W = 326;
  const PANEL_H = 356;

  // The panel is portalled to <body>: inside the settings card it would be clipped
  // by the card's own overflow, which cut the category strip off entirely.
  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8);
    const below = r.bottom + 8;
    const top = below + PANEL_H > window.innerHeight ? Math.max(8, r.top - PANEL_H - 8) : below;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  // Full set arrives on first open; the built-in groups work without it
  useEffect(() => {
    if (!open || cachedPayload || loadFailed) return;
    fetch("/emoji.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: EmojiPayload) => { cachedPayload = data; setPayload(data); })
      .catch(() => setLoadFailed(true));
  }, [open, loadFailed]);

  const tabs = useMemo(() => {
    const base = [{ id: "doporucene", label: "Doporučené" }];
    if (!payload) return base;
    return [...base, ...Object.entries(payload.groups).map(([id, label]) => ({ id, label }))];
  }, [payload]);

  const cells = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const local = ALL_CLOSURE_ICONS.filter((i) => i.kw.includes(q)).map((i) => i.char);
      const remote = (payload?.emoji ?? [])
        .filter((e) => e.l.includes(q) || e.t.includes(q))
        .map((e) => e.c);
      return [...new Set([...local, ...remote])].slice(0, 300);
    }
    // Deduplicate: a character may sit in two built-in groups (🍽️ is both "Zavřeno"
    // and "Jídlo a pití"), and React keys must stay unique — duplicates made it reuse
    // stale cells, so the leftovers showed up in every other category.
    if (tab === "doporucene") {
      return [...new Set(CLOSURE_ICON_GROUPS.flatMap((g) => g.icons.map((i) => i.char)))];
    }
    return [...new Set((payload?.emoji ?? []).filter((e) => String(e.g) === tab).map((e) => e.c))];
  }, [query, tab, payload]);

  const activeLabel = tabs.find((t) => t.id === tab)?.label ?? "";

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Vybrat ikonu"
        className="w-11 h-11 rounded-2xl glass-btn inline-flex items-center justify-center active:scale-[0.97] transition"
        onClick={() => setOpen((v) => !v)}
        ref={triggerRef}
        type="button"
      >
        <span className="emoji text-[22px] leading-none">{value || DEFAULT_CLOSURE_ICON}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="rounded-2xl overflow-hidden"
          ref={panelRef}
          role="dialog"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: PANEL_W,
            zIndex: 60,
            // Opaque, not glass: a translucent popover let the text underneath
            // bleed through the emoji grid and made both unreadable.
            background: "#fffefc",
            border: "1px solid rgba(26,18,8,0.12)",
            boxShadow: "0 16px 48px -12px rgba(26,18,8,0.28), 0 4px 12px -4px rgba(26,18,8,0.12)",
            animation: "emoji-pop 150ms ease-out",
          }}
        >
          {/* Search */}
          <div className="p-2.5 pb-1.5">
            <div className="relative">
              <MIcon
                name="search"
                size={16}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#a8a29e" }}
              />
              <input
                className="modal-input w-full text-[13px]"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat emoji…"
                ref={searchRef}
                style={{ paddingLeft: 32 }}
                value={query}
              />
            </div>
          </div>

          {/* Grid */}
          <div
            className="px-1.5 overflow-y-auto scroll-area"
            style={{ height: 232, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, alignContent: "start" }}
          >
            {cells.map((char) => (
              <button
                aria-pressed={value === char}
                className="h-11 rounded-xl emoji text-[24px] leading-none inline-flex items-center justify-center transition hover:bg-black/[0.06] active:scale-[0.97]"
                key={char}
                onClick={() => { onChange(char); setOpen(false); setQuery(""); }}
                style={value === char ? { background: "rgba(26,18,8,0.10)" } : {}}
                type="button"
              >
                {char}
              </button>
            ))}
            {cells.length === 0 && (
              <p className="col-span-6 text-[12px] text-stone-400 px-1.5 py-3">
                Nic nenalezeno — zkus anglicky, nebo vlož vlastní emoji do políčka vedle.
              </p>
            )}
          </div>

          {/* Category strip */}
          <div
            className="flex items-center gap-0.5 px-1.5 py-1.5 mt-1"
            style={{ borderTop: "1px solid rgba(26,18,8,0.08)", background: "rgba(26,18,8,0.025)" }}
          >
            {tabs.map((t) => (
              <button
                aria-label={t.label}
                aria-pressed={!query && tab === t.id}
                className={`flex-1 h-8 rounded-lg emoji text-[16px] leading-none inline-flex items-center justify-center transition ${
                  !query && tab === t.id ? "" : "opacity-45 hover:opacity-100 hover:bg-black/[0.05]"
                }`}
                key={t.id}
                onClick={() => { setTab(t.id); setQuery(""); }}
                style={!query && tab === t.id ? { background: "rgba(26,18,8,0.10)" } : {}}
                title={t.label}
                type="button"
              >
                {GROUP_GLYPH[t.id] ?? "•"}
              </button>
            ))}
          </div>

          <p className="text-[10.5px] text-stone-400 px-3 pb-2">
            {query
              ? `${cells.length} nalezeno`
              : payload
                ? `${activeLabel} · ${payload.count} emoji celkem`
                : loadFailed
                  ? "Plná sada se nenačetla — zobrazeny doporučené"
                  : "Načítám plnou sadu…"}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}
