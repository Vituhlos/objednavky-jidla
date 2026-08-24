"use client";

import { memo, useState } from "react";
import MIcon from "../MIcon";
import { DAY_OPTIONS } from "./constants";

/**
 * Stavební prvky nastavení: karta sekce, popisek pole, přepínač, dlaždice
 * s údajem o verzi.
 *
 * Proti větvi feat/heroui-migration je tahle sada menší. Chybí `SettingsAccordion`,
 * `SettingsTextField`, `SettingsNumberField`, `SettingsAccentSelect`
 * a `SettingsStatus` — to jsou obálky nad HeroUI poli, které tady nemají co
 * obalovat: zdejší formulář jede na holých `input`ech s třídou `modal-input`
 * a čte se přes `FormData`.
 */

export function SettingsSection({
  title,
  icon,
  children,
  helpContent,
  action,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  helpContent?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="glass rounded-3xl overflow-hidden">
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

// mt-auto on the control keeps inputs on one line even when only some fields carry a
// hint — without it a hinted field pushes its input a row lower than its neighbours.
export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 h-full">
      <span className="text-[12px] font-semibold text-stone-600">{label}</span>
      {hint && <span className="text-[10.5px] text-stone-400 -mt-0.5">{hint}</span>}
      <div className="mt-auto">{children}</div>
    </div>
  );
}

export function EmailListInput({
  defaultValue,
  name,
  placeholder,
}: {
  defaultValue: string;
  name: string;
  placeholder: string;
}) {
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

export const SettingsToggle = memo(function SettingsToggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
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

/**
 * Výběr dnů v týdnu jako řada přepínačů.
 *
 * Každý den je vlastní `checkbox` s odvozeným `name` (`prefix_Po`), protože
 * formulář se čte přes `FormData` a `getSettingsUpdates` je zase skládá do
 * jednoho pole odděleného čárkami.
 */
export function SettingsDayPicker({
  label,
  namePrefix,
  activeDays,
}: {
  label: string;
  namePrefix: string;
  activeDays: string[];
}) {
  return (
    <SettingsField label={label}>
      <div className="flex gap-3 flex-wrap mt-0.5">
        {DAY_OPTIONS.map((d) => (
          <label className="flex items-center gap-1.5 cursor-pointer" key={d.code}>
            <div className="relative shrink-0">
              <input
                className="peer sr-only"
                defaultChecked={activeDays.includes(d.code)}
                name={`${namePrefix}_${d.code}`}
                type="checkbox"
              />
              <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
              <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
            </div>
            <span className="text-[12px] font-semibold text-stone-700">{d.label}</span>
          </label>
        ))}
      </div>
    </SettingsField>
  );
}

/** Dlaždice s jedním údajem o buildu. Prázdná hodnota se přizná, netváří se jako nula. */
export function VersionMeta({
  label,
  value,
  mono = false,
  unavailable = "Až v release buildu",
}: {
  label: string;
  value: string;
  mono?: boolean;
  unavailable?: string;
}) {
  const hasValue = !!value;
  return (
    <div className="glass-soft rounded-2xl px-3 py-2.5 min-w-0">
      <p className="text-[10.5px] font-semibold uppercase text-stone-400">{label}</p>
      <p className={`text-[13px] font-semibold truncate ${hasValue ? "text-stone-800" : "text-stone-400"} ${mono && hasValue ? "font-mono" : ""}`}>
        {hasValue ? value : unavailable}
      </p>
    </div>
  );
}
