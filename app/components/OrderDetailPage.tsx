"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderData } from "@/lib/types";
import { DEPARTMENT_LABELS, DEPARTMENT_ACCENT } from "@/lib/types";
import { EXTRAS_ROW_FIELDS } from "@/lib/pricing";
import { actionReopenOrder } from "@/app/actions";
import AppSidebar from "./AppSidebar";

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

export default function OrderDetailPage({ data }: { data: OrderData }) {
  const { order, departments, totalPrice } = data;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-stage">
        <header className="hero">
          <div className="hero__topline">
            <Link href="/historie" style={{ color: "rgba(248,243,234,0.7)", fontSize: "0.9rem" }}>
              ← Zpět na historii
            </Link>
          </div>
          <div className="hero__content">
            <div>
              <p className="hero__eyebrow">Archiv – detail</p>
              <h2>Objednávka {formatDate(order.date)}</h2>
              <p className="hero__description">
                Stav:{" "}
                <strong>{order.status === "sent" ? "Odesláno" : "Koncept"}</strong>
                {order.sentAt && <> · Odesláno: {formatSentAt(order.sentAt)}</>}
                {order.extraEmail && <> · Kopie: {order.extraEmail}</>}
              </p>
            </div>
            <div className="hero__actions">
              <div className="status-card">
                <span className="status-card__label">Celková cena</span>
                <strong className="status--draft">{totalPrice} Kč</strong>
              </div>
              {order.status === "sent" && (
                <button
                  className="btn-reopen"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await actionReopenOrder(order.id);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "…" : "Znovu otevřít"}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="department-stack" style={{ marginTop: "1.5rem" }}>
          {departments.map((dept) => {
            const activeRows = dept.rows.filter(
              (r) => r.personName || r.soupItem || r.mainItem || r.rollCount > 0
            );
            if (activeRows.length === 0) return null;
            const accent = DEPARTMENT_ACCENT[dept.name];
            return (
              <div className={`department department--${accent}`} key={dept.name}>
                <div className="department__header">
                  <div>
                    <p className="department__eyebrow">Oddělení</p>
                    <h2>{DEPARTMENT_LABELS[dept.name]}</h2>
                  </div>
                  <div className="department__meta">
                    <span>Mezisoučet</span>
                    <strong>{dept.subtotal} Kč</strong>
                  </div>
                </div>

                <div className="department__table">
                  <div className="order-row department__table-head">
                    <span>Jméno</span>
                    <span>Polévka</span>
                    <span>H</span>
                    <span>Jídlo</span>
                    <span>Přílohy</span>
                    <span>Cena</span>
                    <span></span>
                  </div>
                  {activeRows.map((row) => {
                    const extrasSummary = EXTRAS_ROW_FIELDS.flatMap((e) => {
                      const count = row[e.rowKey] as number;
                      return count > 0 ? [`${count}× ${e.label}`] : [];
                    }).join(", ");

                    return (
                      <div className="order-row order-row--active" key={row.id}>
                        <span style={{ padding: "0 0.5rem", fontWeight: 600 }}>
                          {row.personName || "–"}
                        </span>
                        <span style={{ padding: "0 0.5rem", fontSize: "0.85rem" }}>
                          {row.soupItem
                            ? `${row.soupItem.code} – ${row.soupItem.name}`
                            : "–"}
                        </span>
                        <span style={{ textAlign: "center", fontSize: "0.85rem" }}>
                          {row.rollCount > 0 ? row.rollCount : ""}
                        </span>
                        <span style={{ padding: "0 0.5rem", fontSize: "0.85rem" }}>
                          {row.mainItem
                            ? `${row.mainItem.code} – ${row.mainItem.name}`
                            : "–"}
                        </span>
                        <span style={{ padding: "0 0.5rem", fontSize: "0.82rem", color: "var(--graphite)" }}>
                          {extrasSummary || "–"}
                        </span>
                        <div className="cell cell--price">{row.rowPrice} Kč</div>
                        <span></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
