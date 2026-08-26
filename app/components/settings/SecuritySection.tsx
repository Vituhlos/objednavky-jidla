"use client";

import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/**
 * PIN k nastavení. Prázdné pole znamená „nechat, jak je“ — ne „smazat“.
 *
 * Pole nesmí být užší než backend: ten přijímá 8 až 128 **libovolných** znaků.
 * Dokud tu byla maska na osm číslic, delší a bezpečnější PIN se sem nedal
 * napsat — a appka je na veřejné adrese, takže čtyři číslice nestačí.
 */
export function SecuritySection() {
  return (
    <SettingsSection icon="lock" title="Zabezpečení">
      <SettingsField
        hint="8 až 128 znaků, klidně slova a mezery. Nechte prázdné, pokud PIN měnit nechcete."
        label="Nový PIN"
      >
        <input
          autoComplete="new-password"
          className="modal-input"
          maxLength={128}
          minLength={8}
          name="newPin"
          placeholder="ponechte prázdné"
          type="password"
        />
      </SettingsField>
      <p className="text-[11.5px] text-stone-500">
        Po změně PINu se Nastavení zamknou a budete se muset novým PINem znovu potvrdit.
      </p>
    </SettingsSection>
  );
}
