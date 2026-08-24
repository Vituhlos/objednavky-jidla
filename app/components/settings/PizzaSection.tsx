"use client";

import type { AppSettings } from "@/lib/settings";
import { SettingsDayPicker, SettingsField, SettingsSection, SettingsToggle } from "./SettingsPrimitives";

/** Pizza je samostatný modul, proto má vlastní záložku i vlastní uzávěrku. */
export function PizzaSection({ settings }: { settings: AppSettings }) {
  const pizzaDays = settings.pizzaCutoffDays.split(",").map((x) => x.trim());

  return (
    <>
      <SettingsSection icon="local_pizza" title="Pizza modul">
        <p className="text-[12.5px] text-stone-500">
          Pizza modul přidává do appky stránku Pizza, sekci v Historii a vlastní příkazy v Telegram botovi. Při vypnutí je vše skryto a scraper běží naprázdno (objednávky v DB zůstávají).
        </p>
        <SettingsToggle defaultChecked={settings.pizzaEnabled !== "false"} label="Zapnout pizza modul" name="pizzaEnabled" />
      </SettingsSection>

      {settings.pizzaEnabled !== "false" && (
        <SettingsSection icon="local_pizza" title="Pizza – uzávěrka">
          <p className="text-[12.5px] text-stone-500">
            V nastavenou dobu se objednávka pizzy automaticky uzavře — nikdo již nebude moci přidávat ani měnit objednávky.
          </p>
          <SettingsToggle defaultChecked={settings.pizzaCutoffEnabled === "true"} label="Zapnout automatickou uzávěrku pizzy" name="pizzaCutoffEnabled" />
          <SettingsField hint="čas kdy se objednávka uzavře" label="Čas uzávěrky">
            <input className="modal-input w-32" defaultValue={settings.pizzaCutoffTime} name="pizzaCutoffTime" type="time" />
          </SettingsField>
          <SettingsDayPicker activeDays={pizzaDays} label="Dny uzávěrky" namePrefix="pizzaCutoffDay" />
        </SettingsSection>
      )}
    </>
  );
}
