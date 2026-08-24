"use client";

import type { AppSettings } from "@/lib/settings";
import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/** Ceny příloh — název pole v `settings` je zároveň `name` inputu. */
const SIDE_DISH_PRICES = [
  { name: "priceRoll", label: "Houska" },
  { name: "priceBreadDumpling", label: "Houskový knedlík" },
  { name: "pricePotatoDumpling", label: "Bramborový knedlík" },
  { name: "priceKetchup", label: "Kečup" },
  { name: "priceTatarka", label: "Tatarka" },
  { name: "priceBbq", label: "BBQ omáčka" },
] as const;

export function PricesSection({ settings }: { settings: AppSettings }) {
  return (
    <>
      <SettingsSection icon="restaurant" title="Ceník jídel">
        <p className="text-[12.5px] text-stone-500">
          Výchozí ceny používané při importu jídelního lístku z webu. Existující položky v menu se nemění.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SettingsField hint="Kč za porci" label="Výchozí cena polévky">
            <input className="modal-input w-24" defaultValue={settings.defaultSoupPrice} min="0" name="defaultSoupPrice" type="number" />
          </SettingsField>
          <SettingsField hint="Kč za porci" label="Výchozí cena jídla">
            <input className="modal-input w-24" defaultValue={settings.defaultMealPrice} min="0" name="defaultMealPrice" type="number" />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection icon="shopping_basket" title="Přílohy a doplňky">
        <p className="text-[12.5px] text-stone-500">
          Ceny příloh zobrazované v modalu a používané pro výpočet ceny řádku.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SIDE_DISH_PRICES.map((price) => (
            <SettingsField hint="Kč/ks" key={price.name} label={price.label}>
              <input className="modal-input w-24" defaultValue={settings[price.name]} min="0" name={price.name} type="number" />
            </SettingsField>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
