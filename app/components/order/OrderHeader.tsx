"use client";

import MIcon from "../MIcon";
import { AnimatedNumber } from "../AnimatedNumber";

/**
 * Informační pruh nad objednávkou: který den, stav uzávěrky, počet objednávek,
 * cena a odeslání.
 *
 * Desktop a mobil mají každý vlastní variantu, protože se liší nejen sazbou,
 * ale i obsahem — na mobil se vejde zkratka („Po uzávěrce · auto“) a přibývá
 * zvonek pro push, který na desktopu sedí jinde.
 *
 * Tečka vedle data je stav SSE. Je záměrně tichá: dokud spojení běží, nemá co
 * říkat, a když spadne, nemá smysl kvůli tomu vyskakovat na celou šířku.
 */
export function OrderHeader({
  dayStr,
  sseConnected,
  isFutureDay,
  futureDayPhrase,
  cutoffTime,
  isSent,
  sentAt,
  isPastCutoff,
  isForceOpen,
  countdown,
  countdownMins,
  autoSendEnabled,
  autoSendTime,
  activeOrderCount,
  totalPrice,
  noMenu,
  isPending,
  sendError,
  pushState,
  onPushToggle,
  onSend,
  onEmptyOrder,
  onHelp,
}: {
  dayStr: string;
  sseConnected: boolean;
  isFutureDay: boolean;
  futureDayPhrase: string | null;
  cutoffTime: string;
  isSent: boolean;
  sentAt: string | null;
  isPastCutoff: boolean;
  isForceOpen: boolean;
  countdown: string | null;
  countdownMins: number | null;
  autoSendEnabled: boolean;
  autoSendTime: string;
  activeOrderCount: number;
  totalPrice: number;
  noMenu: boolean;
  isPending: boolean;
  sendError: string | null;
  pushState: string;
  onPushToggle: () => void;
  onSend: () => void;
  onEmptyOrder: () => void;
  onHelp: () => void;
}) {
  return (
    <>
    {/* ── Desktop info strip ── */}
    {/* min-h: the bar used to shrink by 7px whenever "Odeslat" was absent (future days,
        already sent, auto-send on) – it is the tallest child, so the row collapsed
        with it. Reserving its height keeps the header still while switching days. */}
    <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
      <span className="font-display font-bold text-[15px] text-stone-900 shrink-0">{dayStr}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
        title={sseConnected ? "Živé aktualizace aktivní" : "Připojování…"}
      />
      <div className="flex items-center gap-3 flex-1 text-[12px] text-stone-500">
        {isFutureDay && !isSent && futureDayPhrase && (
          <span className="inline-flex items-center gap-1 text-stone-500 font-medium">
            <MIcon name="schedule" size={13} /> Uzávěrka {futureDayPhrase} v {cutoffTime} · odešle se automaticky
          </span>
        )}
        {!isFutureDay && !isSent && !isPastCutoff && countdown && (
          <span className={`inline-flex items-center gap-1 font-medium ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
            <MIcon name="schedule" size={13} /> Uzávěrka {countdown} ({cutoffTime}){autoSendEnabled ? " · odešle se automaticky" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isPastCutoff && !isForceOpen && (
          <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
            <MIcon name="schedule" size={13} /> Po uzávěrce ({cutoffTime}){autoSendEnabled ? " · odešle se automaticky" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isForceOpen && (
          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
            <MIcon name="lock_open" size={13} /> Objednávání odemčeno{autoSendEnabled ? ` · odešle se v ${autoSendTime}` : ""}
          </span>
        )}
        {isSent && sentAt && (
          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
            <MIcon name="check_circle" size={13} fill /> Odesláno v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {activeOrderCount > 0 && (
          <span className="text-stone-400">
            {activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · <AnimatedNumber suffix=" Kč" value={totalPrice} />
          </span>
        )}
      </div>
      {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn-primary btn-md"
            disabled={isPending}
            onClick={() => { if (activeOrderCount === 0) { onEmptyOrder(); return; } onSend(); }}
            type="button"
          >
            {isPending ? "Odesílám…" : "Odeslat"}
          </button>
        </div>
      )}
      {sendError && <span className="text-[11.5px] text-red-600">{sendError}</span>}
      <button
        aria-label="Nápověda"
        className="glass-btn btn-icon btn-icon--sm text-stone-400 hover:text-stone-600 shrink-0"
        onClick={onHelp}
        type="button"
      >
        <MIcon name="info" size={16} />
      </button>
    </div>

    {/* ── Mobile info strip ── */}
    {/* Dva řádky: nahoře který den a akce, pod tím stav a souhrn. Na jednom řádku
        se datum na úzkém displeji ořezávalo („Pátek 9. 1…") a souhrn byl jen „1 · 110 Kč". */}
    <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 pt-2 pb-2">
      <div className="flex items-center gap-1">
        <h1 className="flex-1 min-w-0 truncate font-display font-bold text-[18px] leading-tight text-stone-900">{dayStr}</h1>
        {pushState !== "unsupported" && pushState !== "denied" && (
          <button
            aria-label={pushState === "subscribed" ? "Vypnout upozornění" : "Zapnout upozornění"}
            onClick={onPushToggle}
            title={pushState === "subscribed" ? "Vypnout push notifikace" : "Zapnout upozornění před uzávěrkou a po odeslání objednávky"}
            className={`shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center transition active:scale-[0.94] ${pushState === "subscribed" ? "text-amber-600" : "text-stone-400"}`}
            type="button"
          >
            <MIcon name={pushState === "subscribed" ? "notifications_active" : "notifications"} size={19} fill={pushState === "subscribed"} />
          </button>
        )}
        <button
          aria-label="Nápověda"
          className="glass-btn btn-icon text-stone-400 shrink-0"
          onClick={onHelp}
          type="button"
        >
          <MIcon name="info" size={18} />
        </button>
      </div>
      <div className="mt-0.5 min-h-[30px] flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px]">
        <span
          aria-label={sseConnected ? "Živé aktualizace aktivní" : "Připojování k živým aktualizacím…"}
          aria-live="polite"
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
          role="img"
          title={sseConnected ? "Živé aktualizace aktivní" : "Připojování…"}
        />
        {isFutureDay && !isSent && futureDayPhrase && (
          <span className="inline-flex items-center gap-1 text-stone-500 font-medium">
            <MIcon name="schedule" size={13} /> Uzávěrka {futureDayPhrase} v {cutoffTime}{!noMenu ? " · auto" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && !isPastCutoff && countdown && (
          <span className={`inline-flex items-center gap-1 font-medium ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
            <MIcon name="schedule" size={13} /> Uzávěrka {countdown}{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isPastCutoff && !isForceOpen && (
          <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
            <MIcon name="schedule" size={13} /> Po uzávěrce{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {!isFutureDay && !isSent && isForceOpen && (
          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
            <MIcon name="lock_open" size={13} /> Odemčeno{autoSendEnabled ? " · auto" : ""}
          </span>
        )}
        {isSent && (
          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
            <MIcon name="check_circle" size={13} fill /> Odesláno
          </span>
        )}
        {activeOrderCount > 0 && (
          <span className="text-stone-500">
            {activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · <strong className="font-semibold text-stone-700"><AnimatedNumber suffix=" Kč" value={totalPrice} /></strong>
          </span>
        )}
        {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
          <button
            className="btn-primary btn-md ml-auto shrink-0"
            disabled={isPending}
            onClick={() => { if (activeOrderCount === 0) { onEmptyOrder(); return; } onSend(); }}
            type="button"
          >
            {isPending ? "Odesílám…" : "Odeslat"}
          </button>
        )}
      </div>
    </div>
    {sendError && (
      <div role="alert" className="md:hidden px-4 py-2 flex items-center gap-2 text-[12px] text-red-600 border-b border-red-100/80" style={{ background: "rgba(220,38,38,0.05)" }}>
        <MIcon name="warning" size={13} style={{ flexShrink: 0 }} />
        {sendError}
      </div>
    )}
    </>
  );
}
