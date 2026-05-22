"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSwipeable } from "react-swipeable";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
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

const REVEAL_W = 76;

function SwipeableHistoryRow({ href, date, status, isDraft }: {
  href: string;
  date: string;
  status: string;
  isDraft: boolean;
}) {
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const revealed = dragX >= REVEAL_W;
  const wasSwipedRef = useRef(false);

  const handlers = useSwipeable({
    onSwiping: ({ deltaX, dir }) => {
      if (dir === "Left") {
        wasSwipedRef.current = true;
        setDragX(Math.min(Math.max(0, deltaX), REVEAL_W));
      } else if (dir === "Right") {
        setDragX(0);
      }
    },
    onSwipedLeft: ({ absX }) => {
      setDragX(absX >= REVEAL_W / 2 ? REVEAL_W : 0);
      setTimeout(() => { wasSwipedRef.current = false; }, 100);
    },
    onSwipedRight: () => {
      setDragX(0);
      setTimeout(() => { wasSwipedRef.current = false; }, 100);
    },
    onSwiped: ({ dir }) => {
      if (dir !== "Left" && dir !== "Right") setDragX(0);
    },
    preventScrollOnSwipe: false,
    trackMouse: false,
    delta: 10,
  });

  const { ref: swipeRef, ...swipeEventProps } = handlers;

  return (
    <div
      ref={swipeRef}
      className={`relative overflow-hidden border-b border-white/30 last:border-0 select-none ${isDraft ? "opacity-60" : ""}`}
    >
      {/* Reveal action — clipPath skryje reveal když dragX=0, odkryje při swipe */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-l-2xl"
        style={{
          width: REVEAL_W,
          background: "linear-gradient(135deg,#F59E0B,#EA580C)",
          clipPath: `inset(0 0 0 ${Math.max(0, REVEAL_W - dragX)}px)`,
          transition: dragX === REVEAL_W || dragX === 0 ? "clip-path 0.2s ease" : "none",
        }}
      >
        <button
          className="flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-bold w-full h-full"
          onClick={() => router.push(href)}
          type="button"
        >
          <MIcon name="arrow_forward" size={16} style={{ color: "white" }} />
          Otevřít
        </button>
      </div>

      {/* Row content */}
      <div
        className="flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-white/50 transition-colors"
        style={{
          transform: `translateX(-${dragX}px)`,
          transition: dragX === REVEAL_W || dragX === 0 ? "transform 0.2s ease" : "none",
        }}
        onClick={() => {
          if (wasSwipedRef.current) return;
          if (dragX > 0) { setDragX(0); return; }
          router.push(href);
        }}
        {...(swipeEventProps as React.HTMLAttributes<HTMLDivElement>)}
      >
        <span className="font-semibold text-[12.5px] text-stone-800 flex-1">{formatDate(date)}</span>
        <StatusBadge status={status} />
        <MIcon name="chevron_right" size={16} style={{ color: "#d4c5b5", flexShrink: 0 }} />
      </div>
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const q = search.trim().toLowerCase();

  const visibleOrders = hideEmpty ? orders.filter((o) => o.status === "sent" || o.rowCount > 0) : orders;
  const visiblePizza = hideEmpty ? pizzaOrders.filter((o) => o.status === "sent" || o.rowCount > 0) : pizzaOrders;

  const filteredOrders = q
    ? visibleOrders.filter((o) => formatDate(o.date).includes(q) || (o.extraEmail ?? "").toLowerCase().includes(q))
    : visibleOrders;
  const filteredPizza = q
    ? visiblePizza.filter((o) => formatDate(o.date).includes(q))
    : visiblePizza;

  const sentCount = orders.filter((o) => o.status === "sent").length;
  const pizzaSentCount = pizzaOrders.filter((o) => o.status === "sent").length;

  return (
    <div className="k-shell">
      <h1 className="sr-only">Historie objednávek</h1>

      {/* Desktop topbar */}
      <div className="hidden xl:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900 flex-1">Historie objednávek</span>
        <span className="text-[12px] text-stone-500">
          <strong className="text-stone-700">{sentCount}</strong> obědů ·{" "}
          <strong className="text-stone-700">{pizzaSentCount}</strong> pizz
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative shrink-0">
            <input checked={hideEmpty} className="peer sr-only" onChange={(e) => setHideEmpty(e.target.checked)} type="checkbox" />
            <div className="w-8 h-[18px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
            <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
          </div>
          <span className="text-[12px] text-stone-600">Skrýt prázdné koncepty</span>
        </label>
        <input
          className="modal-input !py-1.5 !text-[12px] w-56"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat (datum, e-mail)…"
          type="search"
          value={search}
        />
      </div>

      {/* Mobile topbar */}
      <div className="xl:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Historie</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div className="relative shrink-0">
              <input checked={hideEmpty} className="peer sr-only" onChange={(e) => setHideEmpty(e.target.checked)} type="checkbox" />
              <div className="w-8 h-[18px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
              <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
            </div>
            <span className="text-[11px] text-stone-600">Skrýt prázdné</span>
          </label>
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

      <div className="flex-1 overflow-y-auto scroll-area p-4 xl:p-5 pb-nav">
      <div className="space-y-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0 xl:items-start">
        {/* LIMA orders */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(59,130,246,0.07)" }}>
            <MIcon name="restaurant_menu" size={17} fill style={{ color: "#3B82F6" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Obědy LIMA</span>
            <span className="text-[11px] text-stone-500">{visibleOrders.length} záznamů · {sentCount} odesláno</span>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <MIcon name="history" size={22} style={{ color: "#94a3b8" }} />
              </div>
              <p className="empty-state__title">{q ? "Žádné výsledky" : "Zatím žádné objednávky"}</p>
              {q && <p className="empty-state__sub">Zkuste jiný hledaný výraz</p>}
            </div>
          ) : (
            <>
              {/* Mobile swipeable rows */}
              <div className="xl:hidden">
                {filteredOrders.map((order) => (
                  <SwipeableHistoryRow
                    key={order.id}
                    href={`/historie/${order.id}`}
                    date={order.date}
                    status={order.status}
                    isDraft={order.status !== "sent"}
                  />
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                      <th className="text-left px-4 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Datum</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Stav</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Odesláno</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Řádků</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide hidden xl:table-cell">Doplňkový e-mail</th>
                      <th className="w-8 px-3 py-2"><span className="sr-only">Otevřít</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const isDraft = order.status !== "sent";
                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-white/30 last:border-0 hover:bg-white/60 active:bg-white/80 transition cursor-pointer select-none ${isDraft ? "opacity-60" : ""}`}
                          onClick={() => router.push(`/historie/${order.id}`)}
                          onKeyDown={(e) => e.key === "Enter" && router.push(`/historie/${order.id}`)}
                          role="link"
                          tabIndex={0}
                        >
                          <td className="px-4 py-3 font-semibold text-stone-800">{formatDate(order.date)}</td>
                          <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                          <td className="px-3 py-3 text-stone-500">{formatSentAt(order.sentAt)}</td>
                          <td className="px-3 py-3 text-stone-500">{order.rowCount}</td>
                          <td className="px-3 py-3 text-stone-500 hidden xl:table-cell">{order.extraEmail ?? "–"}</td>
                          <td className="px-3 py-3 text-stone-400">
                            <MIcon name="chevron_right" size={16} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Pizza orders */}
        <section className="glass rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(234,88,12,0.07)" }}>
            <MIcon name="local_pizza" size={17} fill style={{ color: "#EA580C" }} />
            <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Pizza</span>
            <span className="text-[11px] text-stone-500">{visiblePizza.length} záznamů · {pizzaSentCount} odesláno</span>
          </div>
          {filteredPizza.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <MIcon name="local_pizza" size={22} style={{ color: "#94a3b8" }} />
              </div>
              <p className="empty-state__title">{q ? "Žádné výsledky" : "Zatím žádné pizzové objednávky"}</p>
              {q && <p className="empty-state__sub">Zkuste jiný hledaný výraz</p>}
            </div>
          ) : (
            <>
              {/* Mobile swipeable rows */}
              <div className="xl:hidden">
                {filteredPizza.map((order) => (
                  <SwipeableHistoryRow
                    key={order.id}
                    href={`/historie/pizza/${order.id}`}
                    date={order.date}
                    status={order.status}
                    isDraft={order.status !== "sent"}
                  />
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                      <th className="text-left px-4 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Datum</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Stav</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Odesláno</th>
                      <th className="text-left px-3 py-2 font-display font-semibold text-stone-600 text-[11px] uppercase tracking-wide">Řádků</th>
                      <th className="w-8 px-3 py-2"><span className="sr-only">Otevřít</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPizza.map((order) => {
                      const isDraft = order.status !== "sent";
                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-white/30 last:border-0 hover:bg-white/60 active:bg-white/80 transition cursor-pointer select-none ${isDraft ? "opacity-60" : ""}`}
                          onClick={() => router.push(`/historie/pizza/${order.id}`)}
                          onKeyDown={(e) => e.key === "Enter" && router.push(`/historie/pizza/${order.id}`)}
                          role="link"
                          tabIndex={0}
                        >
                          <td className="px-4 py-3 font-semibold text-stone-800">{formatDate(order.date)}</td>
                          <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                          <td className="px-3 py-3 text-stone-500">{formatSentAt(order.sentAt)}</td>
                          <td className="px-3 py-3 text-stone-500">{order.rowCount}</td>
                          <td className="px-3 py-3 text-stone-400">
                            <MIcon name="chevron_right" size={16} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
