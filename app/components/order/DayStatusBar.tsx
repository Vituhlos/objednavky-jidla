"use client";

import MIcon from "../MIcon";

/**
 * Pruh pod panely: v jakém je den stavu a kolik to dělá.
 *
 * Text se mění podle toho, co je zrovna pravda — odesláno, po uzávěrce,
 * odemčeno ředitelem, nebo se ještě normálně objednává. Je to poslední věc
 * na stránce schválně: kdo scrolluje až sem, dočetl objednávku a ptá se
 * „a co teď?“.
 */
export function DayStatusBar({
  cutoffTime,
  isSent,
  sentAt,
  isCutoffLocked,
  isForceOpen,
  isOrderLocked,
  isFutureDay,
  futureDayPhrase,
  autoSendEnabled,
  autoSendTime,
  totalPrice,
  onUnlock,
}: {
  cutoffTime: string;
  isSent: boolean;
  sentAt: string | null;
  isCutoffLocked: boolean;
  isForceOpen: boolean;
  isOrderLocked: boolean;
  isFutureDay: boolean;
  futureDayPhrase: string | null;
  autoSendEnabled: boolean;
  autoSendTime: string;
  totalPrice: number;
  onUnlock: () => void;
}) {
  return (
    <div
      className="glass rounded-2xl px-4 py-3 flex items-center gap-3 mx-auto w-fit max-w-full"
      style={
        isSent
          ? { borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.07)" }
          : isCutoffLocked
          ? { borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }
          : {}
      }
    >
      <div
        className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: isSent ? "rgba(34,197,94,0.15)" : isCutoffLocked ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)" }}
      >
        <MIcon
          name={isSent ? "check_circle" : isCutoffLocked ? "lock" : "lock_open"}
          size={18}
          fill
          style={{ color: isSent ? "#16a34a" : isCutoffLocked ? "#D97706" : "#94a3b8" }}
        />
      </div>
      <div className="text-[12.5px] text-stone-700 leading-snug">
        {isSent ? (
          <>
            <strong className="text-green-700">Objednávka odeslána</strong>
            {sentAt && <span> v {new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span>}
            <span className="text-stone-500"> · Další úpravy nejsou možné.</span>
          </>
        ) : isCutoffLocked ? (
          <>
            <strong className="text-amber-700">Objednávky uzavřeny</strong>
            <span className="text-stone-500"> · Uzávěrka proběhla v {cutoffTime}.</span>
          </>
        ) : isForceOpen ? (
          <>
            <strong className="text-green-700">Objednávání odemčeno</strong>
            <span className="text-stone-500">
              {` · Uzávěrka v ${cutoffTime} dnes už neplatí.`}
              {autoSendEnabled ? ` Objednávka se odešle v ${autoSendTime}.` : ""}
            </span>
          </>
        ) : isFutureDay ? (
          <>
            <strong>Objednávka dopředu.</strong>
            <span className="text-stone-500"> Odešle se automaticky v den samotný v {cutoffTime}.</span>
          </>
        ) : (
          <>
            <strong>Uzávěrka v {cutoffTime}.</strong>
            <span className="text-stone-500"> Objednávky se přijímají do {cutoffTime}.</span>
          </>
        )}
      </div>
      {isCutoffLocked && (
        <button
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-amber-700"
          onClick={onUnlock}
          type="button"
        >
          <MIcon name="lock_open" size={14} /> Odemknout
        </button>
      )}
      {!isOrderLocked && totalPrice > 0 && (
        <span className="font-display font-bold text-[14px] text-stone-800 shrink-0">{totalPrice} Kč</span>
      )}
    </div>
  );
}
