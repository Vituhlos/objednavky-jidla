"use client";

import MIcon from "../MIcon";

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
        already sent, auto-send on) — it is the tallest child, so the row collapsed
        with it. Reserving its height keeps the header still while switching days. */}
    <div className="hidden md:flex px-5 py-2.5 min-h-[60px] border-b border-white/50 items-center gap-4 topbar shrink-0">
      <span className="font-display font-bold text-[15px] text-stone-900 shrink-0">{dayStr}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
        title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
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
            {activeOrderCount} {activeOrderCount === 1 ? "objednávka" : activeOrderCount < 5 ? "objednávky" : "objednávek"} · {totalPrice} Kč
          </span>
        )}
      </div>
      {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="px-4 py-2.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 hover:opacity-[0.88] active:scale-[0.97] transition"
            disabled={isPending}
            onClick={() => { if (activeOrderCount === 0) { onEmptyOrder(); return; } onSend(); }}
            style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
            type="button"
          >
            {isPending ? "Odesílám…" : "Odeslat"}
          </button>
        </div>
      )}
      {sendError && <span className="text-[11.5px] text-red-600">{sendError}</span>}
      <button
        aria-label="Nápověda"
        className="w-8 h-8 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0"
        onClick={onHelp}
        type="button"
      >
        <MIcon name="info" size={16} />
      </button>
    </div>

    {/* ── Mobile info strip ── */}
    <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 min-h-[60px] flex items-center gap-2.5">
      <MIcon name="calendar_today" size={13} style={{ color: "#D97706" }} />
      <span className="text-[12.5px] font-medium text-stone-700 truncate">{dayStr}</span>
      {activeOrderCount > 0 && (
        <span className="text-[11px] text-stone-500 shrink-0">
          {activeOrderCount} · {totalPrice} Kč
        </span>
      )}
      <span
        aria-label={sseConnected ? "Živé aktualizace aktivní" : "Připojování k živým aktualizacím…"}
        aria-live="polite"
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${sseConnected ? "bg-green-400" : "bg-slate-300"}`}
        role="img"
        title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
      />
      {isFutureDay && !isSent && futureDayPhrase && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-stone-500 font-medium shrink-0">
          <MIcon name="schedule" size={12} /> {futureDayPhrase} {cutoffTime}
        </span>
      )}
      {!isFutureDay && !isSent && !isPastCutoff && countdown && (
        <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium shrink-0 ${countdownMins !== null && countdownMins <= 10 ? "text-red-500" : countdownMins !== null && countdownMins <= 30 ? "text-orange-500" : "text-stone-500"}`}>
          <MIcon name="schedule" size={12} /> {countdown}{autoSendEnabled ? " · auto" : ""}
        </span>
      )}
      {!isFutureDay && !isSent && isPastCutoff && !isForceOpen && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-orange-600 shrink-0">
          <MIcon name="schedule" size={12} /> Po uzávěrce{autoSendEnabled ? " · auto" : ""}
        </span>
      )}
      {!isFutureDay && !isSent && isForceOpen && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-green-700 font-medium shrink-0">
          <MIcon name="lock_open" size={12} /> Odemčeno{autoSendEnabled ? " · auto" : ""}
        </span>
      )}
      {isSent && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-green-700 font-semibold shrink-0">
          <MIcon name="check_circle" size={12} fill /> Odesláno
        </span>
      )}
      {pushState !== "unsupported" && pushState !== "denied" && (
        <button
          onClick={onPushToggle}
          title={pushState === "subscribed" ? "Vypnout push notifikace" : "Zapnout upozornění 20 min před uzávěrkou"}
          className={`shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center transition ${pushState === "subscribed" ? "text-amber-600" : "text-stone-400 hover:text-amber-500"}`}
          type="button"
        >
          <MIcon name={pushState === "subscribed" ? "notifications_active" : "notifications"} size={15} fill={pushState === "subscribed"} />
        </button>
      )}
      {!isSent && !isFutureDay && !noMenu && !autoSendEnabled && (
        <button
          className="shrink-0 px-3.5 py-2.5 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-50 active:scale-[0.97] transition"
          disabled={isPending}
          onClick={() => { if (activeOrderCount === 0) { onEmptyOrder(); return; } onSend(); }}
          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
          type="button"
        >
          {isPending ? "Odesílám…" : "Odeslat"}
        </button>
      )}
      {isFutureDay && !isSent && !noMenu && (
        <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
          <MIcon name="schedule" size={12} />
          Auto
        </span>
      )}
      <button
        aria-label="Nápověda"
        className="ml-auto w-9 h-9 rounded-full glass-btn inline-flex items-center justify-center text-stone-400 shrink-0"
        onClick={onHelp}
        type="button"
      >
        <MIcon name="info" size={17} />
      </button>
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
