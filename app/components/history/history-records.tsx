import MIcon from "../MIcon";
import {
  formatHistoryDate,
  formatHistorySentAt,
  type HistoryRecord,
} from "./history-utils";

function StatusBadge({ status }: { status: HistoryRecord["status"] }) {
  const sent = status === "sent";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={sent
        ? { background: "rgba(21,128,61,0.12)", color: "#15803d" }
        : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
    >
      {sent ? "Odesláno" : "Koncept"}
    </span>
  );
}

interface HistoryRecordsProps {
  label: string;
  icon: string;
  iconColor: string;
  accent: string;
  emptyTitle: string;
  records: HistoryRecord[];
  query: string;
  visibleCount: number;
  sentCount: number;
  /** Sloupec s doplňkovým e-mailem má jen oběd — pizza takové pole nemá. */
  showExtraEmail?: boolean;
  onOpen: (href: string) => void;
}

/**
 * Jedna sekce historie: záhlaví s počty a tabulka záznamů.
 *
 * Obědy a pizza měly dvě samostatné kopie téže tabulky, které se lišily jen
 * ikonou, barvou a jedním sloupcem navíc. Rozdíly jsou teď parametry.
 *
 * Prázdný stav rozlišuje „nic nenalezeno“ od „zatím nic není“: první je
 * důsledek hledání a dá se zrušit, druhý je fakt o datech.
 *
 * Proti větvi feat/heroui-migration tu chybí řazení (`sortDescriptor`,
 * `onSortChange`) — zdejší tabulka se neřadí — a `onClearSearch`, protože
 * prázdný stav nenabízí tlačítko na zrušení filtru.
 */
export function HistoryRecords({
  label,
  icon,
  iconColor,
  accent,
  emptyTitle,
  records,
  query,
  visibleCount,
  sentCount,
  showExtraEmail = false,
  onOpen,
}: HistoryRecordsProps) {
  const isFiltered = query.trim().length > 0;

  return (
    <section className="glass rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: accent }}>
        <MIcon name={icon} size={17} fill style={{ color: iconColor }} />
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{label}</span>
        <span className="text-[11px] text-stone-500">{visibleCount} záznamů · {sentCount} odesláno</span>
      </div>
      {records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <MIcon name={isFiltered ? "history" : icon} size={22} style={{ color: "#94a3b8" }} />
          </div>
          <p className="empty-state__title">{isFiltered ? "Žádné výsledky" : emptyTitle}</p>
          {isFiltered && <p className="empty-state__sub">Zkuste jiný hledaný výraz</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                <th className="text-left px-4 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Datum</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Stav</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide hidden sm:table-cell">Odesláno</th>
                <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide hidden sm:table-cell">Řádků</th>
                {showExtraEmail && (
                  <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide hidden xl:table-cell">Doplňkový e-mail</th>
                )}
                <th className="w-8 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((order) => {
                const isDraft = order.status !== "sent";
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-white/30 last:border-0 hover:bg-white/60 active:bg-white/80 transition cursor-pointer select-none ${isDraft ? "opacity-60" : ""}`}
                    onClick={() => onOpen(order.href)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(order.href)}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="px-4 py-3 font-semibold text-stone-800">{formatHistoryDate(order.date)}</td>
                    <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-3 py-3 text-stone-500 hidden sm:table-cell">{formatHistorySentAt(order.sentAt)}</td>
                    <td className="px-3 py-3 text-stone-500 hidden sm:table-cell">{order.rowCount}</td>
                    {showExtraEmail && (
                      <td className="px-3 py-3 text-stone-500 hidden xl:table-cell">{order.extraEmail ?? "–"}</td>
                    )}
                    <td className="px-3 py-3 text-stone-400">
                      <MIcon name="chevron_right" size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
