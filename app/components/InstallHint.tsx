"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import MIcon from "./MIcon";

/**
 * Nabídka „přidat na plochu" pro mobil v prohlížeči.
 *
 * Na Androidu a v Chromu jde instalace spustit tlačítkem (`beforeinstallprompt`).
 * iOS žádné takové API nemá, takže tam zbývá jen návod — a je to právě iOS, kde
 * push notifikace fungují až v appce přidané na plochu.
 *
 * Po zavření se nabídka na `DISMISS_DAYS` dní neukáže. Nainstalovaná appka ji
 * nevidí nikdy.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "installHintDismissedAt";
const DISMISS_DAYS = 30;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  // iPadOS se hlásí jako Mac; pozná se podle dotykové obrazovky.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};
const getIosHint = () => isIos() && !isStandalone() && !recentlyDismissed();

export default function InstallHint() {
  // Na serveru i při hydrataci false, takže se HTML shoduje; teprve pak se doptá zařízení.
  const iosHint = useSyncExternalStore(noopSubscribe, getIosHint, () => false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Bez preventDefault by Chrome ukázal vlastní lištu a událost zahodil.
      e.preventDefault();
      if (!recentlyDismissed()) setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || (!installEvent && !iosHint)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* jen se příště ukáže znovu */ }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // Událost jde použít jen jednou, ať už dopadla jakkoli.
    setInstallEvent(null);
    if (outcome === "dismissed") dismiss();
  };

  return (
    <aside aria-label="Instalace aplikace" className="md:hidden install-hint glass-card fade-up">
      {/* S tlačítkem „Nainstalovat" by na úzkém displeji nezbylo místo na text. */}
      {!installEvent && (
        <span className="install-hint__icon" aria-hidden="true">
          <MIcon name="restaurant" size={20} fill className="text-white" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-[13.5px] text-stone-900 leading-tight">Kantýna jako appka</div>
        {installEvent ? (
          <div className="text-[12px] text-stone-500 leading-snug mt-0.5">Z plochy, s upozorněním před uzávěrkou.</div>
        ) : (
          <div className="text-[12px] text-stone-500 leading-snug mt-0.5">
            Klepněte na{" "}
            <svg aria-label="Sdílet" role="img" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 text-stone-700">
              <path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
            </svg>{" "}
            a zvolte <strong className="font-semibold text-stone-700">Přidat na plochu</strong>. Až pak fungují upozornění.
          </div>
        )}
      </div>
      {installEvent && (
        <button
          className="btn-primary btn-md shrink-0"
          onClick={install}
          type="button"
        >
          Nainstalovat
        </button>
      )}
      <button
        aria-label="Zavřít nabídku instalace"
        className="shrink-0 w-9 h-9 -mr-1 rounded-full inline-flex items-center justify-center text-stone-400"
        onClick={dismiss}
        type="button"
      >
        <MIcon name="close" size={16} />
      </button>
    </aside>
  );
}
