"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderSummary } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import { HistoryRecords } from "./history/history-records";
import {
  countSentHistoryRecords,
  countVisibleHistoryRecords,
  filterHistoryRecords,
  toLunchHistoryRecords,
  toPizzaHistoryRecords,
} from "./history/history-utils";

/** Přepínač „skrýt prázdné koncepty“ — na desktopu i na mobilu stejný. */
function HideEmptyToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer select-none">
      <div className="relative shrink-0">
        <input checked={checked} className="peer sr-only" onChange={(e) => onChange(e.target.checked)} type="checkbox" />
        <div className="w-8 h-[18px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
        <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </div>
      <span className="text-[11px] md:text-[12px] text-stone-600">{label}</span>
    </label>
  );
}

export default function HistoryPage({
  orders,
  pizzaOrders,
  pizzaEnabled = true,
}: {
  orders: OrderSummary[];
  pizzaOrders: PizzaOrderSummary[];
  pizzaEnabled?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  const lunchRecords = toLunchHistoryRecords(orders);
  const pizzaRecords = toPizzaHistoryRecords(pizzaOrders);

  const filteredOrders = filterHistoryRecords(lunchRecords, search, hideEmpty);
  const filteredPizza = filterHistoryRecords(pizzaRecords, search, hideEmpty);

  const visibleOrdersCount = countVisibleHistoryRecords(lunchRecords, hideEmpty);
  const visiblePizzaCount = countVisibleHistoryRecords(pizzaRecords, hideEmpty);
  const sentCount = countSentHistoryRecords(lunchRecords);
  const pizzaSentCount = countSentHistoryRecords(pizzaRecords);

  const openRecord = (href: string) => router.push(href);

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <span className="font-display font-bold text-[15px] text-stone-900 flex-1">Historie objednávek</span>
        <span className="text-[12px] text-stone-500">
          <strong className="text-stone-700">{sentCount}</strong> obědů
          {pizzaEnabled && <> · <strong className="text-stone-700">{pizzaSentCount}</strong> pizz</>}
        </span>
        <HideEmptyToggle checked={hideEmpty} label="Skrýt prázdné koncepty" onChange={setHideEmpty} />
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
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">Historie</span>
          <HideEmptyToggle checked={hideEmpty} label="Skrýt prázdné" onChange={setHideEmpty} />
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

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:items-start">
          <HistoryRecords
            accent="rgba(59,130,246,0.07)"
            emptyTitle="Zatím žádné objednávky"
            icon="restaurant_menu"
            iconColor="#3B82F6"
            label="Obědy LIMA"
            onOpen={openRecord}
            query={search}
            records={filteredOrders}
            sentCount={sentCount}
            showExtraEmail
            visibleCount={visibleOrdersCount}
          />

          {pizzaEnabled && (
            <HistoryRecords
              accent="rgba(234,88,12,0.07)"
              emptyTitle="Zatím žádné pizzové objednávky"
              icon="local_pizza"
              iconColor="#EA580C"
              label="Pizza"
              onOpen={openRecord}
              query={search}
              records={filteredPizza}
              sentCount={pizzaSentCount}
              visibleCount={visiblePizzaCount}
            />
          )}
        </div>
      </main>
    </div>
  );
}
