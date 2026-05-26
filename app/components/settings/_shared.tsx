"use client";

import { memo, useState } from "react";
import MIcon from "../MIcon";

// ── Utilities ─────────────────────────────────────────────────────────────────

export function formatTs(ts: string): string {
  if (!ts) return "—";
  const normalized =
    ts.includes("T") && (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts))
      ? ts
      : ts.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("cs-CZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getNextAutoSend(enabled: string, time: string, daysStr: string): string {
  if (enabled !== "true") return "Vypnuto";
  const days = daysStr.split(",").map((d) => d.trim()).filter(Boolean);
  if (days.length === 0 || !time) return "Nenastaveno";
  const JS_TO_CODE: Record<number, string> = { 1: "Po", 2: "Út", 3: "St", 4: "Čt", 5: "Pá" };
  const DAY_NAMES: Record<string, string> = { Po: "pondělí", "Út": "úterý", St: "středu", "Čt": "čtvrtek", "Pá": "pátek" };
  try {
    const p = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
    const curDay = p.getDay();
    const curTime = `${String(p.getHours()).padStart(2, "0")}:${String(p.getMinutes()).padStart(2, "0")}`;
    for (let offset = 0; offset < 7; offset++) {
      const jsDay = (curDay + offset) % 7;
      const code = JS_TO_CODE[jsDay];
      if (!code || !days.includes(code)) continue;
      if (offset === 0 && curTime >= time) continue;
      const label = offset === 0 ? "Dnes" : offset === 1 ? "Zítra" : `V ${DAY_NAMES[code] ?? code}`;
      return `${label} v ${time}`;
    }
  } catch { /* ignore */ }
  return `Příštích ${days[0]} v ${time}`;
}

// ── Section card ──────────────────────────────────────────────────────────────

export function Section({ title, icon, children, helpContent, action }: { title: string; icon?: string; children: React.ReactNode; helpContent?: React.ReactNode; action?: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(245,158,11,0.07)" }}>
        {icon && <MIcon name={icon as "settings"} size={17} fill style={{ color: "#D97706" }} />}
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{title}</span>
        {action}
        {helpContent && (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="Nápověda"
            className="w-7 h-7 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 hover:text-amber-600 transition"
          >
            <MIcon name="info" size={15} />
          </button>
        )}
      </div>
      {helpContent && showHelp && (
        <div className="px-4 pt-3 pb-1 border-b border-white/40 flex flex-col gap-2" style={{ background: "rgba(245,158,11,0.04)" }}>
          {helpContent}
        </div>
      )}
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-stone-600">{label}</span>
      {hint && <span className="text-[10.5px] text-stone-400 -mt-0.5">{hint}</span>}
      {children}
    </div>
  );
}

// ── Email list input ──────────────────────────────────────────────────────────

export function EmailListInput({ defaultValue, name, placeholder }: { defaultValue: string; name: string; placeholder: string }) {
  return (
    <input
      className="modal-input"
      defaultValue={defaultValue}
      name={name}
      placeholder={placeholder}
      type="text"
    />
  );
}

// ── Toggle checkbox ───────────────────────────────────────────────────────────

export const Toggle = memo(function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div className="relative shrink-0">
        <input type="checkbox" className="peer sr-only" name={name} defaultChecked={defaultChecked} />
        <div className="w-11 h-[22px] rounded-full transition-colors bg-black/15 peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
        <div className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
      </div>
      <span className="text-[13px] text-stone-700">{label}</span>
    </label>
  );
});
