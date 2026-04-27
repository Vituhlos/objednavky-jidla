"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderData, OrderRowEnriched } from "@/lib/types";
import { actionReopenOrder } from "@/app/actions";
import AppTopBar from "./AppTopBar";
import MIcon from "./MIcon";

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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getChips(row: OrderRowEnriched): string[] {
  const chips: string[] = [];
  if (row.rollCount > 0)           chips.push(`Houska ×${row.rollCount}`);
  if (row.breadDumplingCount > 0)  chips.push(`H. kned. ×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) chips.push(`B. kned. ×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0)        chips.push(`Kečup ×${row.ketchupCount}`);
  if (row.tatarkaCount > 0)        chips.push(`Tatarka ×${row.tatarkaCount}`);
  if (row.bbqCount > 0)            chips.push(`BBQ ×${row.bbqCount}`);
  return chips;
}

function pluralOrders(n: number): string {
  if (n === 1) return "objednávka";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

function ReadOnlyRow({ row, dc }: { row: OrderRowEnriched; dc: typeof DC_DEFAULT }) {
  const chips = getChips(row);
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/30 last:border-0">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-display font-bold shrink-0 mt-0.5"
        style={{ background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
      >
        {getInitials(row.personName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-slate-800">{row.personName || "—"}</span>
          {row.rowPrice > 0 && (
            <span className="text-[12px] font-display font-bold text-slate-600 ml-auto shrink-0">{row.rowPrice} Kč</span>
          )}
        </div>
        {row.mainItem && (
          <div className="text-[12px] text-slate-600 mt-0.5">
            {(row.mealCount || 1) > 1 && <strong className="text-slate-800">{row.mealCount}× </strong>}
            {row.mainItem.code && <span className="font-mono text-[10.5px] text-slate-400 mr-0.5">{row.mainItem.code}</span>}
            {row.mainItem.name}
            {row.extraMealItems.map((em, i) => (
              <span key={i} className="block text-[11.5px] text-slate-400">
                {em.count > 1 && <strong>{em.count}× </strong>}
                {em.item.code && <span className="font-mono text-[10px] mr-0.5">{em.item.code}</span>}
                {em.item.name}
              </span>
            ))}
          </div>
        )}
        {row.soupItem && (
          <div className="text-[11.5px] text-slate-500 mt-0.5">
            Polévka: {row.soupItem.code && <span className="font-mono text-[10.5px] mr-0.5">{row.soupItem.code}</span>}{row.soupItem.name}
            {row.soupItem2 && <span className="text-slate-400"> · {row.soupItem2.code && <span className="font-mono text-[10.5px]">{row.soupItem2.code}</span>} {row.soupItem2.name}</span>}
          </div>
        )}
        {(chips.length > 0 || row.note) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {chips.map((c) => (
              <span key={c} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-slate-600 border border-slate-200/70">{c}</span>
            ))}
            {row.note && (
              <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-slate-600 border border-slate-200/70" title={row.note}>✎ {row.note}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailPage({ data }: { data: OrderData }) {
  const { order, departments, totalPrice } = data;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canReopen =
    order.status === "sent" &&
    order.date === new Date().toISOString().slice(0, 10);

  const sent = order.status === "sent";

  return (
    <div className="k-shell">
      <AppTopBar />

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <Link className="text-[12px] text-slate-400 hover:text-slate-600 transition" href="/historie">← Historie</Link>
        <span className="font-display font-bold text-[15px] text-slate-900">Objednávka {formatDate(order.date)}</span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={sent ? { background: "rgba(21,128,61,0.12)", color: "#15803d" } : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
        >
          {sent ? "Odesláno" : "Koncept"}
        </span>
        {order.sentAt && <span className="text-[12px] text-slate-500">{formatSentAt(order.sentAt)}</span>}
        {order.extraEmail && <span className="text-[12px] text-slate-500">Kopie: {order.extraEmail}</span>}
        <div className="ml-auto flex items-center gap-3">
          {totalPrice > 0 && (
            <span className="font-display font-bold text-[16px] text-slate-900">{totalPrice} Kč</span>
          )}
          {canReopen && (
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-full glass-soft text-slate-600 disabled:opacity-50 hover:bg-white/50 active:scale-[0.97] transition"
              disabled={pending}
              onClick={() => startTransition(async () => { await actionReopenOrder(order.id); router.refresh(); })}
              type="button"
            >
              {pending ? "…" : "Znovu otevřít"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link className="text-[12px] text-slate-400" href="/historie">←</Link>
          <span className="font-display font-bold text-[14px] text-slate-900 flex-1">
            Objednávka {formatDate(order.date)}
          </span>
          {totalPrice > 0 && (
            <span className="font-display font-bold text-[14px] text-slate-900">{totalPrice} Kč</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={sent ? { background: "rgba(21,128,61,0.12)", color: "#15803d" } : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
          >
            {sent ? "Odesláno" : "Koncept"}
          </span>
          {order.sentAt && <span className="text-[11px] text-slate-500">{formatSentAt(order.sentAt)}</span>}
          {canReopen && (
            <button
              className="ml-auto text-[11px] font-semibold px-2.5 py-1.5 rounded-full glass-soft text-slate-600 disabled:opacity-50 hover:bg-white/50 active:scale-[0.97] transition"
              disabled={pending}
              onClick={() => startTransition(async () => { await actionReopenOrder(order.id); router.refresh(); })}
              type="button"
            >
              {pending ? "…" : "Znovu otevřít"}
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-28 md:pb-8">
        {departments.every((dept) =>
          dept.rows.every((r) => !r.personName && !r.soupItem && !r.mainItem && r.rollCount === 0)
        ) && (
          <div className="glass rounded-2xl px-4 py-8 text-[13px] text-slate-400 text-center">
            Objednávka neobsahuje žádné položky.
          </div>
        )}
        {departments.map((dept) => {
          const activeRows = dept.rows.filter(
            (r) => r.personName || r.soupItem || r.mainItem || r.rollCount > 0
          );
          if (activeRows.length === 0) return null;
          const dc = DEPT_COLORS[dept.accent] ?? DC_DEFAULT;
          return (
            <section
              className="glass rounded-3xl overflow-hidden"
              key={dept.name}
              style={{ borderColor: dc.border }}
            >
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: dc.bg }}>
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${dc.icon}22` }}
                >
                  <MIcon name="groups" size={14} fill style={{ color: dc.icon }} />
                </div>
                <span className="font-display font-bold text-[13.5px] text-slate-900 flex-1">{dept.label}</span>
                <span className="text-[11px] text-slate-500">
                  {activeRows.length} {pluralOrders(activeRows.length)}
                  {dept.subtotal > 0 && <> · <strong className="text-slate-700">{dept.subtotal} Kč</strong></>}
                </span>
              </div>
              {activeRows.map((row) => (
                <ReadOnlyRow dc={dc} key={row.id} row={row} />
              ))}
            </section>
          );
        })}
      </main>
    </div>
  );
}
