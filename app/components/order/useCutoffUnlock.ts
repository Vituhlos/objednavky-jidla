"use client";

import { useCallback, useState } from "react";
import { actionCheckPin, actionUnlockCutoff } from "@/app/actions";
import { forceOpenStamp } from "@/lib/cutoff";
import { getPragueNow } from "@/lib/time";

/**
 * Nouzové otevření objednávek po uzávěrce na správcovský PIN.
 *
 * Hook drží jen **razítko odemčení** — jestli z něj plyne otevřeno, rozhoduje
 * `useCutoff` podle aktuálního času uzávěrky. Odemčení totiž promíjí pouze tu
 * uzávěrku, která už proběhla; když se čas posune dál, zase platí. Server drží
 * stejné pravidlo, tohle je jen jeho klientský odraz.
 *
 * PIN se posílá **jedinému místu, které ho smí vidět** — `actionCheckPin`.
 * Ta ho ověří, započítá pokus a vystaví HttpOnly doklad; teprve pak má smysl
 * volat samotné odemčení. Starý argument `actionUnlockCutoff` zůstal kvůli
 * kompatibilitě a backend ho ignoruje, takže se do něj nic neposílá.
 */
export function useCutoffUnlock(initialForceOpenAt: string) {
  const [forceOpenAt, setForceOpenAt] = useState(initialForceOpenAt);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const openUnlock = useCallback(() => {
    setShowUnlockModal(true);
    setUnlockPin("");
    setUnlockError(null);
  }, []);

  const closeUnlock = useCallback(() => {
    setShowUnlockModal(false);
    setUnlockPin("");
  }, []);

  // Psaní do pole zahazuje chybu z minulého pokusu — jinak by u přepsaného
  // PINu pořád svítilo „Nesprávný PIN" k hodnotě, která už tam není.
  const changePin = useCallback((value: string) => {
    setUnlockPin(value);
    setUnlockError(null);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (isUnlocking) return; // pojistka proti dvojímu odeslání
    setUnlockError(null);
    setIsUnlocking(true);

    try {
      const overeni = await actionCheckPin(unlockPin);
      if (!overeni.ok) {
        // PIN v poli po neúspěchu nedrž — příští pokus se píše od začátku.
        setUnlockPin("");
        setUnlockError(
          overeni.lockedUntil
            ? `Moc pokusů po sobě. Zkuste to znovu ${new Date(overeni.lockedUntil).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}.`
            : "Nesprávný PIN."
        );
        return;
      }

      // Od téhle chvíle se prokazuje HttpOnly doklad, ne zadaná hodnota.
      setUnlockPin("");

      // Prázdný řetězec záměrně: parametr zůstal jen kvůli kompatibilitě
      // a backend ho ignoruje. Poslat sem PIN by ho vynášelo mimo actionCheckPin.
      const result = await actionUnlockCutoff("");
      if (result.ok) {
        setForceOpenAt(forceOpenStamp(getPragueNow()));
        setShowUnlockModal(false);
      } else {
        setUnlockError(result.error ?? "Odemknutí se nepodařilo.");
      }
    } catch {
      setUnlockPin("");
      setUnlockError("Odemknutí se nepodařilo.");
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocking, unlockPin]);

  return {
    forceOpenAt,
    showUnlockModal,
    unlockPin,
    unlockError,
    isUnlocking,
    openUnlock,
    closeUnlock,
    changePin,
    handleUnlock,
  };
}
