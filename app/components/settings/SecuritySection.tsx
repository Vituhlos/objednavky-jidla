"use client";

import { SettingsField, SettingsSection } from "./SettingsPrimitives";

/** PIN k nastavení. Prázdné pole znamená „nechat, jak je“ — ne „smazat“. */
export function SecuritySection() {
  return (
    <SettingsSection icon="lock" title="Zabezpečení">
      <SettingsField hint="nechte prázdné pro zachování stávajícího PINu" label="Nový PIN (číslice)">
        <input className="modal-input w-36" inputMode="numeric" maxLength={8} name="newPin" pattern="[0-9]*" placeholder="ponechte prázdné" type="password" />
      </SettingsField>
    </SettingsSection>
  );
}
