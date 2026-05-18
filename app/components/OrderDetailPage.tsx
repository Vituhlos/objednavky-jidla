"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderData, OrderRowEnriched } from "@/lib/types";
import { actionReopenOrder } from "@/app/actions";
import MIcon from "./MIcon";

const DEPT_COLORS: Record<string, { bg: string; soft: string; icon: string; grad: string }> = {
  blue:   { bg: "rgba(59,130,246,0.06)",  soft: "rgba(59,130,246,0.12)",  icon: "#3B82F6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
  rust:   { bg: "rgba(194,101,77,0.06)",  soft: "rgba(194,101,77,0.12)",  icon: "#C2654D", grad: "linear-gradient(135deg,#fb923c,#C2654D)" },
  green:  { bg: "rgba(79,138,83,0.06)",   soft: "rgba(79,138,83,0.12)",   icon: "#4F8A53", grad: "linear-gradient(135deg,#86efac,#4F8A53)" },
  amber:  { bg: "rgba(245,158,11,0.06)",  soft: "rgba(245,158,11,0.12)",  icon: "#D97706", grad: "linear-gradient(135deg,#fbbf24,#D97706)" },
  navy:   { bg: "rgba(30,64,175,0.06)",   soft: "rgba(30,64,175,0.12)",   icon: "#1e40af", grad: "linear-gradient(135deg,#60a5fa,#1e40af)" },
  orange: { bg: "rgba(234,88,12,0.06)",   soft: "rgba(234,88,12,0.12)",   icon: "#EA580C", grad: "linear-gradient(135deg,#fb923c,#EA580C)" },
  red:    { bg: "rgba(220,38,38,0.06)",   soft: "rgba(220,38,38,0.12)",   icon: "#dc2626", grad: "linear-gradient(135deg,#f87171,#dc2626)" },
};
const DC_DEFAULT = DEPT_COLORS.blue;

const DAYS_CS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

function formatDateWithDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = DAYS_CS[new Date(y, m - 1, d).getDay()];
  return `${dow} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

function formatSentTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit", minute: "2-digit",
  });
}

function getPragueTodayISO(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getExtras(row: OrderRowEnriched): string[] {
  const extras: string[] = [];
  if (row.rollCount > 0)           extras.push(`Houska×${row.rollCount}`);
  if (row.breadDumplingCount > 0)  extras.push(`H.kn.×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) extras.push(`B.kn.×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0)        extras.push(`Kečup×${row.ketchupCount}`);
  if (row.tatarkaCount > 0)        extras.push(`Tatarka×${row.tatarkaCount}`);
  if (row.bbqCount > 0)            extras.push(`BBQ×${row.bbqCount}`);
  return extras;
}

function isActiveRow(row: OrderRowEnriched): boolean {
  return !!(row.personName || row.soupItem || row.mainItem || row.rollCount > 0);
}

function pluralPeople(n: number): string {
  if (n === 1) return "osoba";
  if (n <= 4) return "osoby";
  return "osob";
}

function pluralMeals(n: number): string {
  if (n === 1) return "jídlo";
  if (n <= 4) return "jídla";
  return "jídel";
}

export default function OrderDetailPage({
  data,
  hasPdf = false,
  apiBase = "",
}: {
  data: OrderData;
  hasPdf?: boolean;
  apiBase?: string;
}) {
  const { order, departments, totalPrice } = data;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canReopen = order.status === "sent" && order.date === getPragueTodayISO();
  const sent = order.status === "sent";
  const sentTime = formatSentTime(order.sentAt ?? null);

  const activeDepts = departments.filter((dept) => dept.rows.some(isActiveRow));
  const isEmpty = activeDepts.length === 0;
  const totalRowCount = activeDepts.reduce(
    (sum, dept) => sum + dept.rows.filter(isActiveRow).length,
    0
  );

  return (
    <div className="k-shell">
      {/* Breadcrumb header */}
      <div
        className="px-5 py-3 border-b border-white/50 flex items-center gap-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.28)" }}
      >
        <Link
          href={`${apiBase}/historie`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-900 transition no-underline"
        >
          <MIcon name="arrow_back" size={15} />
          Historie
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-display font-bold text-[13px] text-slate-900">
          {formatDateWithDay(order.date)}
        </span>
        {sent ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.14)", color: "#047857" }}
          >
            <MIcon name="check_circle" size={12} fill />
            Odesláno{sentTime && ` · ${sentTime}`}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(148,163,184,0.18)", color: "#475569" }}
          >
            <MIcon name="edit_note" size={12} fill /> Koncept
          </span>
        )}
        <div className="flex-1" />
        {sent && hasPdf && (
          <a
            href={`${apiBase}/api/orders/${order.id}/pdf?download=1`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 transition px-3 py-1.5 glass rounded-2xl no-underline"
          >
            <MIcon name="download" size={15} /> Exportovat PDF
          </a>
        )}
        {canReopen && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await actionReopenOrder(order.id);
                router.refresh();
              })
            }
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 transition px-3 py-1.5 glass rounded-2xl disabled:opacity-50"
          >
            <MIcon name="lock_open" size={15} />
            {pending ? "…" : "Znovu otevřít"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-area p-5">
        <div className="flex flex-col gap-4 pb-6">
          {isEmpty && (
            <div className="glass rounded-2xl px-4 py-10 text-center text-[13px] text-slate-400">
              Objednávka neobsahuje žádné položky.
            </div>
          )}
          {activeDepts.map((dept) => {
            const activeRows = dept.rows.filter(isActiveRow);
            const dc = DEPT_COLORS[dept.accent] ?? DC_DEFAULT;
            return (
              <div
                key={dept.name}
                className="glass rounded-3xl overflow-hidden"
                style={{ borderLeft: `4px solid ${dc.icon}` }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/40"
                  style={{ background: dc.bg }}
                >
                  <div
                    className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
                    style={{ background: dc.soft }}
                  >
                    <MIcon name="groups" size={18} fill style={{ color: dc.icon }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[14px] text-slate-900 leading-none">
                      {dept.label}
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">
                      {activeRows.length} {pluralPeople(activeRows.length)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      Mezisoučet
                    </div>
                    <div className="font-display font-bold text-[14px] text-slate-900 tabular-nums">
                      {dept.subtotal} Kč
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody>
                      {activeRows.map((row) => {
                        const extras = getExtras(row);
                        return (
                          <tr key={row.id} className="border-t border-white/40">
                            <td className="px-4 py-2.5" style={{ width: "22%" }}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center justify-center rounded-full text-white font-display font-bold text-[10px] shrink-0"
                                  style={{
                                    width: 26,
                                    height: 26,
                                    background: dc.grad,
                                    boxShadow: "0 0 0 2px rgba(255,255,255,0.85)",
                                  }}
                                >
                                  {getInitials(row.personName)}
                                </span>
                                <span className="text-[12.5px] font-semibold text-slate-800 whitespace-nowrap">
                                  {row.personName || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-[11.5px] text-slate-700" style={{ width: "22%" }}>
                              {row.soupItem ? (
                                <>
                                  {row.soupItem.code && (
                                    <span className="font-mono text-[10.5px] text-slate-400 mr-0.5">
                                      {row.soupItem.code}
                                    </span>
                                  )}
                                  {row.soupItem.name}
                                  {row.soupItem2 && (
                                    <span className="block text-[11px] text-slate-400">
                                      {row.soupItem2.code && (
                                        <span className="font-mono text-[10px] mr-0.5">
                                          {row.soupItem2.code}
                                        </span>
                                      )}
                                      {row.soupItem2.name}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-[11.5px] text-slate-700">
                              {row.mainItem ? (
                                <>
                                  {(row.mealCount || 1) > 1 && (
                                    <strong className="text-slate-800">{row.mealCount}× </strong>
                                  )}
                                  {row.mainItem.code && (
                                    <span className="font-mono text-[10.5px] text-slate-400 mr-0.5">
                                      {row.mainItem.code}
                                    </span>
                                  )}
                                  {row.mainItem.name}
                                  {row.extraMealItems.map((em, i) => (
                                    <span key={i} className="block text-[11px] text-slate-400">
                                      {em.count > 1 && <strong>{em.count}× </strong>}
                                      {em.item.code && (
                                        <span className="font-mono text-[10px] mr-0.5">{em.item.code}</span>
                                      )}
                                      {em.item.name}
                                    </span>
                                  ))}
                                </>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {extras.length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">—</span>
                                ) : (
                                  extras.map((e, i) => (
                                    <span
                                      key={i}
                                      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md font-mono"
                                      style={{ background: "rgba(148,163,184,0.18)", color: "#475569" }}
                                    >
                                      {e}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-display font-bold text-[12.5px] text-slate-900 tabular-nums"
                              style={{ width: 80 }}
                            >
                              {row.rowPrice > 0 ? `${row.rowPrice} Kč` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom summary bar */}
      <div
        className="border-t border-white/55 px-5 py-3 flex items-center gap-4 shrink-0"
        style={{ background: "rgba(255,255,255,0.42)", backdropFilter: "blur(22px)" }}
      >
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">Celkem</div>
          <div className="font-display font-extrabold text-[18px] text-slate-900 tabular-nums">
            {totalRowCount} {pluralMeals(totalRowCount)}
          </div>
        </div>
        <div className="w-px h-8 bg-slate-300/40 shrink-0" />
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">Cena</div>
          <div
            className="font-display font-extrabold text-[18px] tabular-nums"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {totalPrice.toLocaleString("cs-CZ")} Kč
          </div>
        </div>
        <div className="flex-1" />
        {sent && hasPdf && (
          <a
            href={`${apiBase}/api/orders/${order.id}/pdf?download=1`}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold font-display px-4 py-2 rounded-2xl text-white transition no-underline"
            style={{
              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
              boxShadow: "0 8px 20px -8px rgba(234,88,12,0.5)",
            }}
          >
            <MIcon name="download" size={16} fill />
            Exportovat PDF
          </a>
        )}
      </div>
    </div>
  );
}
