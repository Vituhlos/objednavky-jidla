"use client";

import { useState, useEffect, useRef } from "react";
import type { DepartmentData } from "@/lib/types";
import { hasOrderRowContent } from "@/lib/order-utils";
import AppTopBar from "./AppTopBar";

// ── Icons ─────────────────────────────────────────────────

const IconCheck = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
    <path d="M22 4L12 14.01l-3-3M22 11.08V12a10 10 0 11-5.93-9.14"/>
  </svg>
);

const IconClock = () => (
  <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────

function mealLabel(row: DepartmentData["rows"][number]): string {
  const parts: string[] = [];
  if (row.mainItem) {
    const prefix = (row.mealCount ?? 1) > 1 ? `${row.mealCount}× ` : "";
    parts.push(`${prefix}${row.mainItem.code} ${row.mainItem.name}`);
  }
  for (const { item, count } of row.extraMealItems) {
    parts.push(`${count > 1 ? `${count}× ` : ""}${item.code} ${item.name}`);
  }
  return parts.join(", ") || "—";
}

function soupLabel(row: DepartmentData["rows"][number]): string {
  const parts: string[] = [];
  if (row.soupItem) parts.push(`${row.soupItem.code} ${row.soupItem.name}`);
  if (row.soupItem2) parts.push(`${row.soupItem2.code} ${row.soupItem2.name}`);
  return parts.join(", ") || "—";
}

function extrasLabel(row: DepartmentData["rows"][number]): string {
  const parts: string[] = [];
  if (row.rollCount > 0) parts.push(`${row.rollCount}× houska`);
  if (row.breadDumplingCount > 0) parts.push(`${row.breadDumplingCount}× hous. kned.`);
  if (row.potatoDumplingCount > 0) parts.push(`${row.potatoDumplingCount}× bram. kned.`);
  if (row.ketchupCount > 0) parts.push(`${row.ketchupCount}× kečup`);
  if (row.tatarkaCount > 0) parts.push(`${row.tatarkaCount}× tatarka`);
  if (row.bbqCount > 0) parts.push(`${row.bbqCount}× BBQ`);
  return parts.join(", ");
}

function pluralPeople(n: number) {
  if (n === 1) return "1 osoba";
  if (n <= 4) return `${n} osoby`;
  return `${n} osob`;
}

// ── Component ─────────────────────────────────────────────

export default function OverviewPage({
  initialDepartments,
  initialStatus,
  initialSentAt,
  initialTotalPrice,
  orderDate,
}: {
  initialDepartments: DepartmentData[];
  initialStatus: "draft" | "sent";
  initialSentAt: string | null;
  initialTotalPrice: number;
  orderDate: string;
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [status, setStatus] = useState(initialStatus);
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [totalPrice, setTotalPrice] = useState(initialTotalPrice);
  const [sseConnected, setSseConnected] = useState(false);
  const isPendingRef = useRef(false);

  useEffect(() => {
    const es = new EventSource("/api/sse");
    es.addEventListener("open", () => setSseConnected(true));
    es.addEventListener("error", () => setSseConnected(false));
    es.addEventListener("change", () => {
      setSseConnected(true);
      if (isPendingRef.current) return;
      fetch("/api/order-refresh")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { departments: DepartmentData[]; totalPrice: number; status: string; sentAt: string | null } | null) => {
          if (!data) return;
          setDepartments(data.departments);
          setStatus(data.status as "draft" | "sent");
          setTotalPrice(data.totalPrice);
          if (data.sentAt) setSentAt(data.sentAt);
        })
        .catch(() => {});
    });
    return () => es.close();
  }, []);

  const allActiveRows = departments.flatMap((d) => d.rows.filter(hasOrderRowContent));
  const totalPeople = allActiveRows.length;

  const today = new Date();
  const dayStr =
    today.toLocaleDateString("cs-CZ", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()) +
    " " +
    today.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

  return (
    <div className="v2-shell">
      <AppTopBar />

      {/* ── Info strip ── */}
      <div className="v2-infostrip">
        <div className="v2-infostrip__facts">
          <span className="v2-fact">
            <span>{dayStr}</span>
            <span
              className={`sse-dot${sseConnected ? " sse-dot--on" : ""}`}
              title={sseConnected ? "Živé aktualizace aktivní" : "Připojování..."}
            />
          </span>
          {status === "sent" ? (
            <span className="v2-fact" style={{ color: "var(--green)" }}>
              <IconCheck />
              <span>
                Odesláno{" "}
                {sentAt &&
                  new Date(sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
          ) : (
            <span className="v2-fact" style={{ color: "var(--v2-text-muted, #6b7280)" }}>
              <IconClock />
              <span>Objednávka se připravuje</span>
            </span>
          )}
        </div>
      </div>

      <main className="v2-content">
        {/* ── Summary stats ── */}
        <div className="overview-stats">
          <div className="overview-stat">
            <span className="overview-stat__val">{pluralPeople(totalPeople)}</span>
            <span className="overview-stat__label">celkem objednalo</span>
          </div>
          {departments.filter((d) => d.rows.filter(hasOrderRowContent).length > 0).map((d) => (
            <div className="overview-stat" key={d.name}>
              <span className="overview-stat__val">{d.rows.filter(hasOrderRowContent).length}</span>
              <span className="overview-stat__label">{d.label}</span>
            </div>
          ))}
          {totalPrice > 0 && (
            <div className="overview-stat overview-stat--price">
              <span className="overview-stat__val">{totalPrice} Kč</span>
              <span className="overview-stat__label">celkem</span>
            </div>
          )}
        </div>

        {/* ── Per-department tables ── */}
        {departments.map((dept) => {
          const activeRows = dept.rows.filter(hasOrderRowContent);
          return (
            <section className={`overview-dept v2-dept--${dept.accent}`} key={dept.name}>
              <div className="overview-dept__header">
                <h2 className="overview-dept__title">{dept.label}</h2>
                <span className="overview-dept__meta">
                  {activeRows.length > 0
                    ? `${pluralPeople(activeRows.length)} · ${dept.subtotal} Kč`
                    : "Nikdo neobjednal"}
                </span>
              </div>

              {activeRows.length > 0 && (
                <div className="overview-table-wrap">
                  <table className="overview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jméno</th>
                        <th>Polévka</th>
                        <th>Jídlo</th>
                        <th>Přílohy</th>
                        <th>Poznámka</th>
                        <th className="overview-table__price">Cena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="overview-table__num">{idx + 1}</td>
                          <td className="overview-table__name">{row.personName || "—"}</td>
                          <td>{soupLabel(row)}</td>
                          <td>{mealLabel(row)}</td>
                          <td className="overview-table__extras">{extrasLabel(row) || "—"}</td>
                          <td className="overview-table__note">{row.note || ""}</td>
                          <td className="overview-table__price">{row.rowPrice > 0 ? `${row.rowPrice} Kč` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}

        {allActiveRows.length === 0 && (
          <div className="v2-alert v2-alert--warn" style={{ marginTop: "1rem" }}>
            Zatím nikdo nic neobjednal.
          </div>
        )}
      </main>
    </div>
  );
}
