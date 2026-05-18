"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import MIcon from "./MIcon";

function formatSentTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit", minute: "2-digit",
  });
}

function getWeekday(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  const s = d.toLocaleDateString("cs-CZ", { weekday: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HistoryPage({
  orders,
  pizzaOrders: _pizzaOrders,
  apiBase = "",
}: {
  orders: OrderSummary[];
  pizzaOrders?: PizzaOrderSummary[];
  apiBase?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "sent" | "draft">("all");

  const visible = orders.filter((h) =>
    filter === "all" ? true : h.status === filter
  );

  return (
    <div className="k-shell">
      <div
        className="px-5 py-3 border-b border-white/50 flex items-center gap-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.28)" }}
      >
        <h2 className="font-display font-extrabold text-[18px] text-slate-900">Historie objednávek</h2>
        <div className="flex-1" />
        <div className="glass-soft rounded-2xl p-1 flex items-center gap-0.5">
          {(
            [
              ["all", "Vše"],
              ["sent", "Odesláno"],
              ["draft", "Rozpracováno"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`text-[11.5px] font-semibold px-3 py-1 rounded-xl transition ${
                filter === k ? "text-white" : "text-slate-600"
              }`}
              style={filter === k ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-5">
        <div className="flex flex-col gap-2.5 pb-6">
          {visible.length === 0 ? (
            <div className="glass rounded-2xl px-4 py-10 text-center text-[13px] text-slate-400">
              Žádné záznamy
            </div>
          ) : (
            visible.map((h) => {
              const isSent = h.status === "sent";
              const d = new Date(`${h.date}T12:00:00`);
              const dayNum = d.getDate();
              const monthShort = d.toLocaleDateString("cs-CZ", { month: "short" });
              const weekday = getWeekday(h.date);
              const sentTime = formatSentTime(h.sentAt);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => router.push(`${apiBase}/historie/${h.id}`)}
                  className="glass rounded-2xl p-4 flex items-center gap-4 transition hover:translate-x-0.5 text-left w-full"
                >
                  <div className="flex flex-col items-center w-14 shrink-0">
                    <div className="font-display font-extrabold text-[20px] text-slate-900 tabular-nums leading-none">
                      {dayNum}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                      {monthShort}
                    </div>
                  </div>
                  <div className="w-px h-9 bg-slate-300/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[14px] text-slate-900">{weekday}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5">
                      {isSent ? (
                        <>
                          Odesláno
                          {sentTime && (
                            <>
                              {" "}v{" "}
                              <strong className="text-slate-700 tabular-nums">{sentTime}</strong>
                            </>
                          )}
                        </>
                      ) : (
                        "Rozpracovaná objednávka"
                      )}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-5 text-right shrink-0">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Jídel</div>
                      <div className="font-display font-bold text-[14px] text-slate-900 tabular-nums">
                        {h.rowCount}
                      </div>
                    </div>
                    {typeof h.totalPrice === "number" && h.totalPrice > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Cena</div>
                        <div
                          className="font-display font-bold text-[14px] tabular-nums"
                          style={
                            isSent
                              ? {
                                  background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                                  WebkitBackgroundClip: "text",
                                  WebkitTextFillColor: "transparent",
                                }
                              : { color: "#94a3b8" }
                          }
                        >
                          {h.totalPrice.toLocaleString("cs-CZ")} Kč
                        </div>
                      </div>
                    )}
                  </div>
                  {isSent ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: "rgba(16,185,129,0.14)", color: "#047857" }}
                    >
                      <MIcon name="check_circle" size={12} fill /> Odesláno
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: "rgba(148,163,184,0.18)", color: "#475569" }}
                    >
                      <MIcon name="edit_note" size={12} fill /> Rozpracováno
                    </span>
                  )}
                  <span className="text-amber-700 font-semibold text-[12px] inline-flex items-center gap-1 ml-2 shrink-0">
                    Detail <MIcon name="arrow_forward" size={13} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
