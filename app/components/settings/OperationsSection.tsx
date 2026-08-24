"use client";

import type { AppSettings } from "@/lib/settings";
import MIcon from "../MIcon";
import { getNextAutoSend } from "./settings-utils";
import { SettingsDayPicker, SettingsField, SettingsSection, SettingsToggle } from "./SettingsPrimitives";

/**
 * Uzávěrka a automatické odeslání.
 *
 * Obojí jsou pole formuláře, takže sekce nesmí být odmontovaná, když je
 * záložka schovaná — jinak by se hodnoty do `FormData` vůbec nedostaly.
 * Skrývání proto řeší CSS u rodiče, ne podmínka tady.
 */
export function OperationsSection({ settings }: { settings: AppSettings }) {
  const activeDays = settings.autoSendDays.split(",").map((d) => d.trim());

  return (
    <>
      <SettingsSection icon="schedule" title="Provoz">
        <SettingsField hint="zobrazuje se v hlavičce objednávkové stránky" label="Čas uzávěrky">
          <input className="modal-input w-32" defaultValue={settings.cutoffTime} name="cutoffTime" type="time" />
        </SettingsField>
      </SettingsSection>

      <SettingsSection icon="schedule" title="Automatické odeslání">
        <p className="text-[12.5px] text-stone-500">
          Objednávka se automaticky odešle v nastavenou dobu. Přeskočí se pokud je den označen jako zavřený nebo pokud není splněný minimální počet objednávek.
        </p>
        <SettingsToggle defaultChecked={settings.autoSendEnabled === "true"} label="Zapnout automatické odeslání" name="autoSendEnabled" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SettingsField hint="čas kdy se objednávka automaticky odešle" label="Čas odeslání">
            <input className="modal-input w-32" defaultValue={settings.autoSendTime} name="autoSendTime" type="time" />
          </SettingsField>
          <SettingsField hint="minimálně N objednávek, jinak se přeskočí" label="Minimální počet objednávek">
            <input className="modal-input w-24" defaultValue={settings.autoSendMinOrders} min="1" name="autoSendMinOrders" type="number" />
          </SettingsField>
        </div>
        <SettingsDayPicker activeDays={activeDays} label="Dny odeslání" namePrefix="autoSendDay" />
        <SettingsField hint="e-mail(y) kam přijde upozornění při selhání auto-send — prázdné = použije se adresa z upozornění na jídelníček" label="Upozornění při selhání">
          <input className="modal-input" defaultValue={settings.autoSendFailureEmail} name="autoSendFailureEmail" placeholder="admin@firma.cz" type="email" />
        </SettingsField>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <MIcon name="event_upcoming" size={14} style={{ color: "#D97706" }} />
          <span className="text-stone-500">Příští odeslání:</span>
          <span className="font-semibold text-stone-700">{getNextAutoSend(settings.autoSendEnabled, settings.autoSendTime, settings.autoSendDays)}</span>
        </div>
      </SettingsSection>
    </>
  );
}
