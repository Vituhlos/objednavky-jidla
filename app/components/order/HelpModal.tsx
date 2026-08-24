"use client";

import { useEffect, useState } from "react";
import MIcon from "../MIcon";

/**
 * Nápověda k objednávání.
 *
 * Rozdělená na základ a „pokročilé“: prvních pár kroků potřebuje každý nový
 * člověk, zbytek jen ten, kdo hledá konkrétní vychytávku. Kdyby se ukázalo
 * všechno naráz, základ by v tom zapadl.
 */
const HELP_STEPS = [
  { num: "①", title: "Přidej se", body: 'Klikni na „+ Přidat" u svého oddělení. Zadej jméno a příjmení — pod tím jménem se objednávka odešle do LIMA.', icon: "groups" },
  { num: "②", title: "Vyber jídlo", body: "Zvol polévku a hlavní jídlo z dnešního menu. Cena se spočítá automaticky.", icon: "restaurant_menu" },
  { num: "③", title: "Hotovo — objednávka se odešle sama", body: "V čas uzávěrky (vidíš ho v horní liště) se objednávka automaticky odešle do LIMA. Nic víc dělat nemusíš.", icon: "check_circle" },
] as const;

const HELP_ADVANCED = [
  { title: "Dvě různé polévky nebo jídla", body: 'Použij „Přidat další jídlo" — v jedné objednávce jich může být víc.', icon: "add" },
  { title: "Víc porcí stejného jídla", body: "Nastav počet porcí přímo u daného jídla.", icon: "receipt_long" },
  { title: "Přílohy a omáčky", body: "Rohlík, knedlík, kečup, tatarka nebo BBQ — přičtou se k ceně automaticky.", icon: "lunch_dining" },
  { title: "Pizza", body: "Záložka Pizza funguje samostatně s vlastním menu a uzávěrkou.", icon: "local_pizza" },
  { title: "Přepínání dnů klávesnicí", body: "Šipky ← → přepínají mezi dostupnými dny v týdnu.", icon: "keyboard" },
] as const;

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    // iOS Safari: overflow:hidden on body doesn't prevent scroll — use position:fixed instead
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="help-modal-title">Jak objednat oběd</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500 text-lg font-bold leading-none"
            onClick={onClose}
            type="button"
          >×</button>
        </div>
        <div className="modal-sheet__body space-y-3">
          {HELP_STEPS.map((s) => (
            <div key={s.num} className="flex gap-3 p-3 rounded-2xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <div
                className="w-9 h-9 rounded-xl shrink-0 inline-flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
              >
                <MIcon name={s.icon} size={18} fill className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-[13px] text-stone-900 leading-snug">{s.title}</p>
                <p className="text-[12.5px] text-stone-600 leading-snug mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}

          <button
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl glass-btn text-stone-600 text-[12.5px] font-semibold"
            onClick={() => setAdvanced((v) => !v)}
            type="button"
          >
            <span>Pokročilé možnosti</span>
            <MIcon name={advanced ? "expand_less" : "expand_more"} size={18} />
          </button>

          {advanced && (
            <div className="space-y-2">
              {HELP_ADVANCED.map((item) => (
                <div key={item.title} className="flex gap-3 px-3 py-2.5 rounded-2xl glass-soft">
                  <MIcon name={item.icon} size={18} fill style={{ color: "#94a3b8", flexShrink: 0, marginTop: 1 }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[12.5px] text-stone-800 leading-snug">{item.title}</p>
                    <p className="text-[12px] text-stone-500 leading-snug mt-0.5">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
