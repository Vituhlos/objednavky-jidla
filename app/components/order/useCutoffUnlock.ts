"use client";

import { useCallback, useState } from "react";
import { actionUnlockCutoff } from "@/app/actions";
import { forceOpenStamp } from "@/lib/cutoff";
import { getPragueNow } from "@/lib/time";

/**
 * Nouzové otevření objednávek po uzávěrce na administrátorský PIN.
 *
 * Hook drží jen **razítko odemčení** — jestli z něj plyne otevřeno, rozhoduje
 * `useCutoff` podle aktuálního času uzávěrky. Odemčení totiž promíjí pouze tu
 * uzávěrku, která už proběhla; když se čas posune dál, zase platí. Server drží
 * stejné pravidlo, tohle je jen jeho klientský odraz.
 */
export function useCutoffUnlock(initialForceOpenAt: string) {
  const [forceOpenAt, setForceOpenAt] = useState(initialForceOpenAt);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const openUnlock = useCallback(() => {
    setShowUnlockModal(true);
    setUnlockPin("");
    setUnlockError(null);
  }, []);

  const closeUnlock = useCallback(() => setShowUnlockModal(false), []);

  // Psaní do pole zahazuje chybu z minulého pokusu — jinak by u přepsaného
  // PINu pořád svítilo „Nesprávný PIN" k hodnotě, která už tam není.
  const changePin = useCallback((value: string) => {
    setUnlockPin(value);
    setUnlockError(null);
  }, []);

  const handleUnlock = useCallback(async () => {
    setUnlockError(null);
    const result = await actionUnlockCutoff(unlockPin);
    if (result.ok) {
      setForceOpenAt(forceOpenStamp(getPragueNow()));
      setShowUnlockModal(false);
      setUnlockPin("");
    } else {
      setUnlockError(result.error ?? "Chyba");
    }
  }, [unlockPin]);

  return {
    forceOpenAt,
    showUnlockModal,
    unlockPin,
    unlockError,
    openUnlock,
    closeUnlock,
    changePin,
    handleUnlock,
  };
}
