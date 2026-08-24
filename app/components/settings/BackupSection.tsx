"use client";

import { useRef, useState, useTransition } from "react";
import MIcon from "../MIcon";
import { SettingsSection } from "./SettingsPrimitives";

/**
 * Stažení zálohy a obnova ze souboru.
 *
 * Obnova je **přídavná**: server přidá jen to, co v databázi ještě není, takže
 * omylem nahraná starší záloha nepřepíše novější data. Souhrn nad tlačítkem
 * proto ukazuje, co v souboru je, ještě než se cokoli zapíše.
 *
 * Nastavení se obnovuje zvlášť a jen na požádání — je to jediná část zálohy,
 * která umí přepsat funkční konfiguraci appky.
 */
export function BackupSection({ isActive }: { isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  type RestoreResult = { orders: number; orderRows: number; menuWeeks: number; departments: number; settings: number };
  const [restoreFile, setRestoreFile] = useState<Record<string, unknown> | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreIncludeSettings, setRestoreIncludeSettings] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreResult(null);
    setRestoreError("");
    setRestoreStatus("idle");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Record<string, unknown>;
        setRestoreFile(parsed);
        setRestoreFileName(file.name);
      } catch {
        setRestoreError("Soubor není platná záloha (neplatný JSON).");
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!restoreFile) return;
    setRestoreStatus("pending");
    setRestoreError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backup: restoreFile, restoreSettings: restoreIncludeSettings }),
        });
        const json = await res.json() as { ok: boolean; result?: RestoreResult; error?: string };
        if (json.ok && json.result) {
          setRestoreResult(json.result);
          setRestoreStatus("done");
          setRestoreFile(null);
          setRestoreFileName("");
          if (restoreInputRef.current) restoreInputRef.current.value = "";
        } else {
          setRestoreError(json.error ?? "Obnova selhala.");
          setRestoreStatus("error");
        }
      } catch {
        setRestoreError("Síťová chyba při obnově.");
        setRestoreStatus("error");
      }
    });
  };

  const backupOrders = Array.isArray((restoreFile as Record<string, unknown> | null)?.orders)
    ? ((restoreFile as Record<string, unknown>).orders as unknown[]).length : 0;
  const backupWeeks = restoreFile
    ? new Set(
        (((restoreFile as Record<string, unknown>).menu_items as Record<string, unknown>[] | undefined) ?? [])
          .map((i) => i.week_start as string)
          .filter(Boolean)
      ).size
    : 0;
  const backupDepts = Array.isArray((restoreFile as Record<string, unknown> | null)?.departments)
    ? ((restoreFile as Record<string, unknown>).departments as unknown[]).length : 0;
  const backupHasSettings = typeof (restoreFile as Record<string, unknown> | null)?.settings === "object";

  if (!isActive) return null;

  return (
<SettingsSection icon="build" title="Záloha a obnova dat">
      <p className="text-[12.5px] text-stone-500">
        Stáhněte zálohu objednávek, jídelníčků, oddělení a nastavení ve formátu JSON, nebo obnovte data ze starší zálohy.
      </p>
      <a
        className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600"
        download
        href="/api/backup"
      >
        <MIcon name="download" size={14} /> Stáhnout zálohu
      </a>

      <div className="border-t border-white/40 pt-3 flex flex-col gap-3">
        <p className="text-[12px] font-semibold text-stone-700">Obnova ze zálohy</p>
        <p className="text-[12px] text-stone-500">
          Obnova je přídavná — přidají se pouze data, která v aplikaci ještě nejsou (podle data objednávky, týdne jídelníčku a názvu oddělení). Existující záznamy zůstanou beze změny.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={restoreInputRef}
            accept=".json"
            className="sr-only"
            id="restore-file-input"
            onChange={handleRestoreFile}
            type="file"
          />
          <label
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl glass-btn text-stone-600 cursor-pointer"
            htmlFor="restore-file-input"
          >
            <MIcon name="upload_file" size={14} /> Vybrat soubor zálohy
          </label>
          {restoreFileName && (
            <span className="text-[11.5px] text-stone-500 truncate max-w-[200px]">{restoreFileName}</span>
          )}
        </div>

        {restoreFile && (
          <div className="glass-soft rounded-2xl p-3 flex flex-col gap-2.5">
            <p className="text-[12px] font-semibold text-stone-700">Obsah zálohy:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[12px] text-stone-600">
              <span>Objednávky: <strong>{backupOrders}</strong></span>
              <span>Týdny menu: <strong>{backupWeeks}</strong></span>
              <span>Oddělení: <strong>{backupDepts}</strong></span>
            </div>
            {backupHasSettings && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative shrink-0">
                  <input
                    checked={restoreIncludeSettings}
                    className="peer sr-only"
                    onChange={(e) => setRestoreIncludeSettings(e.target.checked)}
                    type="checkbox"
                  />
                  <div className="w-9 h-[20px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                  <div className="absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[16px]" />
                </div>
                <span className="text-[12px] text-stone-700">Obnovit také nastavení aplikace (pouze chybějící hodnoty)</span>
              </label>
            )}
            <button
              className="self-start modal-btn modal-btn--primary"
              disabled={isPending || restoreStatus === "pending"}
              onClick={handleRestore}
              type="button"
            >
              {restoreStatus === "pending" ? "Obnovuji..." : "Obnovit data"}
            </button>
          </div>
        )}

        {restoreStatus === "done" && restoreResult && (
          <div className="glass-soft rounded-2xl p-3 flex flex-col gap-1 text-[12px]">
            <p className="font-semibold text-emerald-700 flex items-center gap-1.5">
              <MIcon name="check_circle" size={14} fill /> Obnova dokončena
            </p>
            <p className="text-stone-600">Přidáno: {restoreResult.orders} objednávek, {restoreResult.menuWeeks} týdnů menu, {restoreResult.departments} oddělení{restoreResult.settings > 0 ? `, ${restoreResult.settings} nastavení` : ""}.</p>
          </div>
        )}

        {restoreStatus === "error" && restoreError && (
          <p className="text-[12px] text-red-500">{restoreError}</p>
        )}
      </div>
    </SettingsSection>
  );
}
