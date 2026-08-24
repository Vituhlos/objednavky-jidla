import type { DepartmentData, OrderRowEnriched } from "@/lib/types";
import { getInitials, pluralizeOrders } from "@/lib/format";
import MIcon from "../MIcon";
import { getDetailRows, getRowExtras } from "./order-detail-utils";

/**
 * Barvy oddělení. Klíč je `accent` z tabulky `departments`, takže se paleta
 * dá rozšířit bez zásahu do komponent — jen přibude řádek sem.
 *
 * Ve větvi feat/heroui-migration tohle nahradily theme tokeny, protože barvy
 * oddělení jsou jediné, co HeroUI theming neuchopí (viz REFACTOR-PLAN §B1).
 */
const DEPT_COLORS: Record<string, { bg: string; border: string; icon: string; grad: string }> = {
  blue:   { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.22)",  icon: "#3B82F6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  rust:   { bg: "rgba(194,101,77,0.1)",  border: "rgba(194,101,77,0.22)",  icon: "#C2654D", grad: "linear-gradient(135deg,#fb923c,#C2654D)" },
  green:  { bg: "rgba(79,138,83,0.1)",   border: "rgba(79,138,83,0.22)",   icon: "#4F8A53", grad: "linear-gradient(135deg,#86efac,#4F8A53)" },
  amber:  { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.22)",  icon: "#D97706", grad: "linear-gradient(135deg,#fbbf24,#D97706)" },
  navy:   { bg: "rgba(30,64,175,0.1)",   border: "rgba(30,64,175,0.22)",   icon: "#1e40af", grad: "linear-gradient(135deg,#60a5fa,#1e40af)" },
  orange: { bg: "rgba(234,88,12,0.1)",   border: "rgba(234,88,12,0.22)",   icon: "#EA580C", grad: "linear-gradient(135deg,#fb923c,#EA580C)" },
  red:    { bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.22)",   icon: "#dc2626", grad: "linear-gradient(135deg,#f87171,#dc2626)" },
};
const DC_DEFAULT = DEPT_COLORS.blue;

/** Jeden člověk v historické objednávce — jen ke čtení, nic se tu needituje. */
function ReadOnlyRow({ row, dc }: { row: OrderRowEnriched; dc: typeof DC_DEFAULT }) {
  const chips = getRowExtras(row);
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/30 last:border-0">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-display font-bold shrink-0 mt-0.5"
        style={{ background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
      >
        {getInitials(row.personName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-stone-800">{row.personName || "—"}</span>
          {row.rowPrice > 0 && (
            <span className="text-[12px] font-display font-bold text-stone-600 ml-auto shrink-0">{row.rowPrice} Kč</span>
          )}
        </div>
        {row.mainItem && (
          <div className="text-[12px] text-stone-600 mt-0.5">
            {(row.mealCount || 1) > 1 && <strong className="text-stone-800">{row.mealCount}× </strong>}
            {row.mainItem.code && <span className="font-mono text-[10.5px] text-stone-400 mr-0.5">{row.mainItem.code}</span>}
            {row.mainItem.name}
            {row.extraMealItems.map((em, i) => (
              <span key={i} className="block text-[11.5px] text-stone-400">
                {em.count > 1 && <strong>{em.count}× </strong>}
                {em.item.code && <span className="font-mono text-[10px] mr-0.5">{em.item.code}</span>}
                {em.item.name}
              </span>
            ))}
          </div>
        )}
        {row.soupItem && (
          <div className="text-[11.5px] text-stone-500 mt-0.5">
            Polévka: {row.soupItem.code && <span className="font-mono text-[10.5px] mr-0.5">{row.soupItem.code}</span>}{row.soupItem.name}
            {row.soupItem2 && <span className="text-stone-400"> · {row.soupItem2.code && <span className="font-mono text-[10.5px]">{row.soupItem2.code}</span>} {row.soupItem2.name}</span>}
          </div>
        )}
        {(chips.length > 0 || row.note) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {chips.map((c) => (
              <span key={c} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-stone-600 border border-slate-200/70">{c}</span>
            ))}
            {row.note && (
              <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-stone-600 border border-slate-200/70" title={row.note}>✎ {row.note}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Jedno oddělení v detailu objednávky: záhlaví s počtem a mezisoučtem, pak řádky. */
export function DepartmentSection({ department }: { department: DepartmentData }) {
  const rows = getDetailRows(department);
  const dc = DEPT_COLORS[department.accent] ?? DC_DEFAULT;

  return (
    <section className="glass rounded-3xl overflow-hidden" style={{ borderColor: dc.border }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: dc.bg }}>
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${dc.icon}22` }}
        >
          <MIcon name="groups" size={14} fill style={{ color: dc.icon }} />
        </div>
        <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">{department.label}</span>
        <span className="text-[11px] text-stone-500">
          {rows.length} {pluralizeOrders(rows.length)}
          {department.subtotal > 0 && <> · <strong className="text-stone-700">{department.subtotal} Kč</strong></>}
        </span>
      </div>
      {rows.map((row) => (
        <ReadOnlyRow dc={dc} key={row.id} row={row} />
      ))}
    </section>
  );
}
