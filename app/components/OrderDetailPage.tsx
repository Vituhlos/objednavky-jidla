"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderData, OrderRowEnriched } from "@/lib/types";
import { DEPARTMENT_LABELS, DEPARTMENT_ACCENT } from "@/lib/types";
import { actionReopenOrder } from "@/app/actions";
import AppTopBar from "./AppTopBar";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getChips(row: OrderRowEnriched): string[] {
  const chips: string[] = [];
  if (row.rollCount > 0) chips.push(`Houska ×${row.rollCount}`);
  if (row.breadDumplingCount > 0) chips.push(`H. kned. ×${row.breadDumplingCount}`);
  if (row.potatoDumplingCount > 0) chips.push(`B. kned. ×${row.potatoDumplingCount}`);
  if (row.ketchupCount > 0) chips.push(`Kečup ×${row.ketchupCount}`);
  if (row.tatarkaCount > 0) chips.push(`Tatarka ×${row.tatarkaCount}`);
  if (row.bbqCount > 0) chips.push(`BBQ ×${row.bbqCount}`);
  return chips;
}

function pluralOrders(n: number): string {
  if (n === 1) return "objednávka";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

function ReadOnlyRow({ row, accent }: { row: OrderRowEnriched; accent: string }) {
  const chips = getChips(row);
  return (
    <div className="v2-order-row">
      <div className="v2-order-row__name">
        <div className={`v2-avatar v2-avatar--${accent}`}>{getInitials(row.personName)}</div>
        <span className="v2-order-row__name-text">{row.personName || "—"}</span>
      </div>
      <div className="v2-order-row__main">
        {row.mainItem ? (
          <span>
            {(row.mealCount || 1) > 1 && <strong>{row.mealCount}× </strong>}
            {row.mainItem.name}
            {row.extraMealItems.map((em, i) => (
              <span key={i}>
                <br />
                <span style={{ color: "var(--v2-text-muted)", fontSize: "0.82em" }}>
                  {em.count > 1 && <strong>{em.count}× </strong>}
                  {em.item.name}
                </span>
              </span>
            ))}
          </span>
        ) : <span className="v2-muted">—</span>}
      </div>
      <div className="v2-order-row__soup">
        {row.soupItem ? (
          <span>
            {row.soupItem.name}
            {row.soupItem2 && (
              <>
                <br />
                <span style={{ color: "var(--v2-text-muted)", fontSize: "0.82em" }}>{row.soupItem2.name}</span>
              </>
            )}
          </span>
        ) : <span className="v2-muted">—</span>}
      </div>
      <div className="v2-order-row__extras">
        {chips.map((c) => <span className="v2-chip" key={c}>{c}</span>)}
        {row.note && <span className="v2-note-chip" title={row.note}>✎ {row.note}</span>}
      </div>
      <div className="v2-order-row__price">
        {row.rowPrice > 0 ? `${row.rowPrice} Kč` : <span className="v2-muted">—</span>}
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

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Infostrip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <Link
            href="/historie"
            style={{ color: "var(--v2-text-muted)", fontSize: "0.85rem", textDecoration: "none" }}
          >
            ← Historie
          </Link>
          <span style={{ fontWeight: 700, color: "var(--v2-text)", fontSize: "0.95rem" }}>
            Objednávka {formatDate(order.date)}
          </span>
          <span className="v2-fact">
            {order.status === "sent" ? "✓ Odesláno" : "Koncept"}
            {order.sentAt && <> · {formatSentAt(order.sentAt)}</>}
          </span>
          {order.extraEmail && (
            <span className="v2-fact">Kopie: {order.extraEmail}</span>
          )}
        </div>
        <div className="v2-infostrip__send" style={{ gap: "0.75rem", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--v2-text)" }}>
            {totalPrice} Kč
          </span>
          {canReopen && (
            <button
              className="v2-btn v2-btn--secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await actionReopenOrder(order.id);
                  router.refresh();
                })
              }
              type="button"
            >
              {pending ? "…" : "Znovu otevřít"}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <main className="v2-content">
        {departments.every((dept) =>
          dept.rows.every((r) => !r.personName && !r.soupItem && !r.mainItem && r.rollCount === 0)
        ) && (
          <div className="v2-empty-state" style={{ textAlign: "center", padding: "3rem 1rem" }}>
            Objednávka neobsahuje žádné položky.
          </div>
        )}
        {departments.map((dept) => {
          const activeRows = dept.rows.filter(
            (r) => r.personName || r.soupItem || r.mainItem || r.rollCount > 0
          );
          if (activeRows.length === 0) return null;
          const accent = DEPARTMENT_ACCENT[dept.name];
          return (
            <section className={`v2-dept v2-dept--${accent}`} key={dept.name}>
              <div className="v2-dept__head">
                <div className="v2-dept__info">
                  <div>
                    <h2 className="v2-dept__title">{DEPARTMENT_LABELS[dept.name]}</h2>
                    <span className="v2-dept__count">
                      {activeRows.length} {pluralOrders(activeRows.length)}
                      {dept.subtotal > 0 && <> · <strong>{dept.subtotal} Kč</strong></>}
                    </span>
                  </div>
                </div>
              </div>
              <div className="v2-dept__rows">
                {activeRows.map((row) => (
                  <ReadOnlyRow accent={accent} key={row.id} row={row} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
