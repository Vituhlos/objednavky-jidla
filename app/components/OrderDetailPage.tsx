"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderData } from "@/lib/types";
import { actionReopenOrder } from "@/app/actions";
import { getPragueISODate } from "@/lib/time";
import { DepartmentSection } from "./order-detail/order-detail-records";
import {
  canReopenOrder,
  formatOrderDetailDate,
  formatOrderDetailSentAt,
  getDetailDepartments,
} from "./order-detail/order-detail-utils";
import MIcon from "./MIcon";

function BackButton({ mobile }: { mobile?: boolean }) {
  return (
    <Link
      href="/historie"
      className={`inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 shrink-0 ${mobile ? "text-[13px] px-2 py-1 -ml-1" : "text-[12px] px-2.5 py-1"}`}
    >
      <MIcon name="arrow_back" size={mobile ? 15 : 13} />
      <span>Historie</span>
    </Link>
  );
}

function StatusBadge({ sent }: { sent: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={sent ? { background: "rgba(21,128,61,0.12)", color: "#15803d" } : { background: "rgba(26,18,8,0.07)", color: "#7a6552" }}
    >
      {sent ? "Odesláno" : "Koncept"}
    </span>
  );
}

function ReopenButton({ canReopen, onReopen, pending, small }: { canReopen: boolean; onReopen: () => void; pending: boolean; small?: boolean }) {
  if (!canReopen) return null;
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 ${small ? "text-[11px] px-2.5 py-1.5" : "text-[12px] px-3.5 py-2"}`}
      disabled={pending}
      onClick={onReopen}
      type="button"
    >
      {pending ? "…" : "Znovu otevřít"}
    </button>
  );
}

export default function OrderDetailPage({ data, hasPdf = false }: { data: OrderData; hasPdf?: boolean }) {
  const { order, departments, totalPrice } = data;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canReopen = canReopenOrder(order, getPragueISODate());

  const sent = order.status === "sent";

  const activeDepts = getDetailDepartments(departments);
  const isEmpty = activeDepts.length === 0;
  const handleReopen = () => startTransition(async () => { await actionReopenOrder(order.id); router.refresh(); });

  return (
    <div className="k-shell">

      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <BackButton />
        <span className="font-display font-bold text-[15px] text-stone-900">Objednávka {formatOrderDetailDate(order.date)}</span>
        <StatusBadge sent={sent} />
        {order.sentAt && <span className="text-[12px] text-stone-500">{formatOrderDetailSentAt(order.sentAt)}</span>}
        {order.extraEmail && <span className="text-[12px] text-stone-500 hidden lg:inline">Kopie: {order.extraEmail}</span>}
        <div className="ml-auto flex items-center gap-2">
          {totalPrice > 0 && (
            <span className="font-display font-bold text-[16px] text-stone-900 mr-1">{totalPrice} Kč</span>
          )}
          {sent && hasPdf && (
            <>
              <a
                href={`/api/orders/${order.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full glass-btn text-stone-600"
              >
                <MIcon name="picture_as_pdf" size={14} /> Zobrazit PDF
              </a>
              <a
                href={`/api/orders/${order.id}/pdf?download=1`}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full glass-btn text-stone-600"
              >
                <MIcon name="download" size={14} /> Stáhnout
              </a>
            </>
          )}
          <ReopenButton canReopen={canReopen} onReopen={handleReopen} pending={pending} />
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <BackButton mobile />
          <span className="font-display font-bold text-[14px] text-stone-900 flex-1">
            {formatOrderDetailDate(order.date)}
          </span>
          {totalPrice > 0 && (
            <span className="font-display font-bold text-[14px] text-stone-900">{totalPrice} Kč</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
          <StatusBadge sent={sent} />
          {order.sentAt && <span className="text-[11px] text-stone-500">{formatOrderDetailSentAt(order.sentAt)}</span>}
          <ReopenButton canReopen={canReopen} onReopen={handleReopen} pending={pending} small />
          {sent && hasPdf && (
            <>
              <a
                href={`/api/orders/${order.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-600"
              >
                <MIcon name="picture_as_pdf" size={13} /> PDF
              </a>
              <a
                href={`/api/orders/${order.id}/pdf?download=1`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full glass-btn text-stone-600"
              >
                <MIcon name="download" size={13} /> Stáhnout
              </a>
            </>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="grid md:grid-cols-3 gap-4">
          {isEmpty && (
            <div className="glass rounded-2xl px-4 py-8 text-[13px] text-stone-400 text-center">
              Objednávka neobsahuje žádné položky.
            </div>
          )}
          {activeDepts.map((dept) => (
            <DepartmentSection department={dept} key={dept.name} />
          ))}
        </div>
      </main>
    </div>
  );
}
