"use client";

import { useState } from "react";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import Link from "next/link";
import AppTopBar from "./AppTopBar";
import MIcon from "./MIcon";

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

function StatusBadge({ status }: { status: string }) {
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

function HistoryTable({ rows }: { rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

export default function HistoryPage({
  orders,
  pizzaOrders,
}: {
  orders: OrderSummary[];
  pizzaOrders: PizzaOrderSummary[];
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const filteredOrders = q
    ? orders.filter((o) => formatDate(o.date).includes(q) || (o.extraEmail ?? "").toLowerCase().includes(q))
    : orders;
  const filteredPizza = q
    ? pizzaOrders.filter((o) => formatDate(o.date).includes(q))
    : pizzaOrders;

  const sentCount = orders.filter((o) => o.status === "sent").length;
  const pizzaSentCount = pizzaOrders.filter((o) => o.status === "sent").length;

  return (
    <div className="k-shell">
      <AppTopBar />

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-slate-900 flex-1">Historie objednávek</span>
        <span className="text-[12px] text-slate-500">
          <strong className="text-slate-700">{sentCount}</strong> obědů ·{" "}
          <strong className="text-slate-700">{pizzaSentCount}</strong> pizz
        </span>
        <input
          className="modal-input !py-1.5 !text-[12px] w-56"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat (datum, e-mail)…"
          type="search"
          value={search}
        />
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-slate-900 flex-1">Historie</span>
          <span className="text-[11px] text-slate-500">{sentCount} obědů · {pizzaSentCount} pizz</span>
        </div>
        <div className="px-4 pb-2.5">
          <input
            className="modal-input w-full !py-1.5 !text-[12px]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat (datum, e-mail)…"
            type="search"
            value={search}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-28 md:pb-8">
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:items-start">
        {/* LIMA orders */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(59,130,246,0.07)" }}>
            <MIcon name="restaurant_menu" size={17} fill style={{ color: "#3B82F6" }} />
            <span className="font-display font-bold text-[13.5px] text-slate-900 flex-1">Obědy LIMA</span>
            <span className="text-[11px] text-slate-500">{orders.length} záznamů · {sentCount} odesláno</span>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-slate-400 text-center">
              {q ? "Žádné výsledky pro hledaný výraz" : "Zatím žádné objednávky v databázi."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                    <th className="text-left px-4 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide">Datum</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide">Stav</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Odesláno</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Řádků</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide hidden md:table-cell">Doplňkový e-mail</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-white/30 last:border-0 hover:bg-white/20 transition">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{formatDate(order.date)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={order.status} /></td>
                      <td className="px-3 py-2.5 text-slate-500 hidden sm:table-cell">{formatSentAt(order.sentAt)}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden sm:table-cell">{order.rowCount}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell">{order.extraEmail ?? "–"}</td>
                      <td className="px-3 py-2.5">
                        <Link className="text-amber-600 hover:text-amber-700 font-semibold text-[12px]" href={`/historie/${order.id}`}>
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pizza orders */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(234,88,12,0.07)" }}>
            <MIcon name="local_pizza" size={17} fill style={{ color: "#EA580C" }} />
            <span className="font-display font-bold text-[13.5px] text-slate-900 flex-1">Pizza</span>
            <span className="text-[11px] text-slate-500">{pizzaOrders.length} záznamů · {pizzaSentCount} odesláno</span>
          </div>
          {filteredPizza.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-slate-400 text-center">
              {q ? "Žádné výsledky pro hledaný výraz" : "Zatím žádné pizzové objednávky v databázi."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                    <th className="text-left px-4 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide">Datum</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide">Stav</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Odesláno</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Řádků</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPizza.map((order) => (
                    <tr key={order.id} className="border-b border-white/30 last:border-0 hover:bg-white/20 transition">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{formatDate(order.date)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={order.status} /></td>
                      <td className="px-3 py-2.5 text-slate-500 hidden sm:table-cell">{formatSentAt(order.sentAt)}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden sm:table-cell">{order.rowCount}</td>
                      <td className="px-3 py-2.5">
                        <Link className="text-amber-600 hover:text-amber-700 font-semibold text-[12px]" href={`/historie/pizza/${order.id}`}>
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      </main>
    </div>
  );
}
