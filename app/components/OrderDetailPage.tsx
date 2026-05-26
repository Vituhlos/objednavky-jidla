"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { OrderData, OrderRowEnriched } from "@/lib/types";
import { actionReopenOrder, actionDuplicateOrder } from "@/app/actions";
import { ConfirmModal } from "./ConfirmModal";
import MIcon from "./MIcon";
import PageHeader from "./PageHeader";
import { DeptIcon } from "./dept-icon";

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

const DAYS_CS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const MONTHS_CS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

function getDateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    year: y,
    month: m,
    day: d,
    dow: DAYS_CS[date.getDay()],
    monthName: MONTHS_CS[m - 1],
  };
}

function formatFullDate(iso: string): string {
  const { day, monthName, year, dow } = getDateParts(iso);
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)} ${day}. ${monthName} ${year}`;
}

function getISOWeekRange(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay() || 7; // 1=Monday, 7=Sunday
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dow - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return `Týden ${monday.getDate()}.–${friday.getDate()}. ${friday.getMonth() + 1}.`;
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric", month: "numeric", year: "numeric",
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

function shortMealName(full: string, max = 26): string {
  const firstClause = full.split(",")[0].trim();
  return firstClause.length <= max ? firstClause : firstClause.slice(0, max - 1) + "…";
}

interface ExtraChip { label: string }
function getExtraChips(row: OrderRowEnriched): ExtraChip[] {
  const out: ExtraChip[] = [];
  const pushIfAny = (n: number, label: string) => {
    if (n > 0) out.push({ label: n === 1 ? `+ ${label}` : `+ ${n}× ${label}` });
  };
  pushIfAny(row.rollCount, "houska");
  pushIfAny(row.breadDumplingCount, "h. knedlík");
  pushIfAny(row.potatoDumplingCount, "b. knedlík");
  pushIfAny(row.ketchupCount, "kečup");
  pushIfAny(row.tatarkaCount, "tatarka");
  pushIfAny(row.bbqCount, "BBQ");
  return out;
}

function pluralOrders(n: number): string {
  if (n === 1) return "objednávka";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

// ── Read-only person row (with chip layout matching OrderPage) ────────────────

function ReadOnlyRow({ row, dc }: { row: OrderRowEnriched; dc: typeof DC_DEFAULT }) {
  const extras = getExtraChips(row);
  const hasFood = !!row.mainItem || !!row.soupItem || !!row.soupItem2 || row.extraMealItems.length > 0 || extras.length > 0;
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/30 last:border-0">
      <div
        className="rounded-full inline-flex items-center justify-center text-white font-display font-bold shrink-0 mt-0.5"
        style={{ width: 32, height: 32, fontSize: 12, background: dc.grad, boxShadow: "0 0 0 2px rgba(255,255,255,0.85)" }}
      >
        {getInitials(row.personName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-[13px] text-stone-900 flex-1 min-w-0 truncate">{row.personName || "—"}</span>
          {row.rowPrice > 0 && (
            <span className="shrink-0 font-display font-bold text-[13px] text-stone-900 tabular-nums">{row.rowPrice} Kč</span>
          )}
        </div>
        {hasFood ? (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {row.soupItem && (
              <span className="meal-chip">
                {row.soupItem.code && <>{row.soupItem.code} · </>}
                {shortMealName(row.soupItem.name)}
              </span>
            )}
            {row.soupItem2 && (
              <span className="meal-chip">
                {row.soupItem2.code && <>{row.soupItem2.code} · </>}
                {shortMealName(row.soupItem2.name)}
              </span>
            )}
            {row.mainItem && (
              <span className="meal-chip">
                {(row.mealCount || 1) > 1 ? `${row.mealCount}× ` : ""}
                {row.mainItem.code && <>{row.mainItem.code} · </>}
                {shortMealName(row.mainItem.name)}
              </span>
            )}
            {row.extraMealItems.map((e, i) => (
              <span key={i} className="meal-chip">
                {e.count > 1 ? `${e.count}× ` : ""}
                {e.item.code && <>{e.item.code} · </>}
                {shortMealName(e.item.name)}
              </span>
            ))}
            {extras.map((c) => (
              <span key={c.label} className="meal-chip meal-chip--faded">{c.label}</span>
            ))}
          </div>
        ) : (
          <div className="text-[11.5px] text-stone-400 mt-1">—</div>
        )}
        {row.note && (
          <div className="mt-1.5 text-[11px] text-stone-500 flex items-center gap-1">
            <MIcon name="edit" size={11} style={{ flexShrink: 0 }} />
            <span className="truncate">{row.note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email preview modal ──────────────────────────────────────────────────────

function EmailPreviewModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch(`/api/orders/${orderId}/email-preview`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Načtení preview selhalo");
        return r.text();
      })
      .then(setHtml)
      .catch((e) => setError(e instanceof Error ? e.message : "Chyba"));
  }, [orderId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-preview-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 96vw)", maxHeight: "90vh" }}
      >
        <div className="modal-sheet__header">
          <h3 className="modal-sheet__title" id="email-preview-title">Náhled odeslaného e-mailu</h3>
          <button
            aria-label="Zavřít"
            className="w-11 h-11 rounded-full glass-btn inline-flex items-center justify-center text-stone-500"
            onClick={onClose}
            type="button"
          >
            <MIcon name="close" size={16} />
          </button>
        </div>
        <div className="modal-sheet__body" style={{ padding: 0 }}>
          {error ? (
            <div className="p-4 text-[13px] text-red-600">{error}</div>
          ) : html === null ? (
            <div className="p-4 text-[13px] text-stone-400 text-center">Načítám…</div>
          ) : (
            <iframe
              srcDoc={html}
              title="Náhled e-mailu"
              sandbox="allow-same-origin"
              style={{ width: "100%", minHeight: "60vh", border: 0, background: "white" }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── KPI strip ────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__icon">
        <MIcon name={icon} size={15} fill />
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__value">{value}</span>
        {sub && <span className="kpi-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function OrderDetailPage({ data, hasPdf = false }: { data: OrderData; hasPdf?: boolean }) {
  const { order, departments, totalPrice } = data;
  const [pending, startTransition] = useTransition();
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const router = useRouter();

  const canReopen = order.status === "sent" && order.date === getPragueTodayISO();
  const sent = order.status === "sent";

  const activeDepts = useMemo(
    () => departments.filter((dept) =>
      dept.rows.some((r) => r.personName || r.soupItem || r.mainItem || r.rollCount > 0)
    ),
    [departments]
  );
  const isEmpty = activeDepts.length === 0;

  // ── KPI stats ──
  const stats = useMemo(() => {
    let people = 0, withSoup = 0, mealTotal = 0;
    for (const dept of departments) {
      for (const r of dept.rows) {
        const hasContent = !!(r.personName || r.soupItem || r.mainItem || r.rollCount > 0);
        if (!hasContent) continue;
        people++;
        if (r.soupItem || r.soupItem2) withSoup++;
        mealTotal += (r.mainItem ? (r.mealCount || 1) : 0) + r.extraMealItems.reduce((s, e) => s + e.count, 0);
      }
    }
    const avg = people > 0 ? Math.round(totalPrice / people) : 0;
    return { people, withSoup, mealTotal, avg };
  }, [departments, totalPrice]);

  const dateParts = getDateParts(order.date);
  const weekRange = getISOWeekRange(order.date);

  const handleDuplicate = () => {
    setDuplicateError(null);
    startTransition(async () => {
      try {
        await actionDuplicateOrder(order.id);
        router.push("/");
      } catch (e) {
        setDuplicateError(e instanceof Error ? e.message : "Duplikace selhala");
      }
    });
  };

  return (
    <div className="k-shell">
      <PageHeader
        title="Detail objednávky"
        mobileTitle="Detail"
        meta={
          <span className="breadcrumb">
            <Link
              href="/historie"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full glass-btn text-stone-600 text-[11.5px] font-semibold"
            >
              <MIcon name="arrow_back" size={11} />
              Historie
            </Link>
            <span className="breadcrumb__slash">/</span>
            <span className="text-stone-500">{dateParts.monthName.charAt(0).toUpperCase() + dateParts.monthName.slice(1)} {dateParts.year} · {weekRange}</span>
          </span>
        }
        actions={
          <div className="hidden md:flex items-center gap-2">
            {sent && (
              <button
                type="button"
                onClick={() => setShowEmailPreview(true)}
                className="inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 text-[12px] px-3 py-1.5"
              >
                <MIcon name="info" size={13} /> Náhled e-mailu
              </button>
            )}
            {sent && hasPdf && (
              <a
                href={`/api/orders/${order.id}/pdf?download=1`}
                className="inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 text-[12px] px-3 py-1.5"
              >
                <MIcon name="download" size={13} /> PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowDuplicateConfirm(true)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 font-semibold rounded-full text-white text-[12px] px-3.5 py-1.5 disabled:opacity-50 active:scale-[0.97] transition"
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
            >
              <MIcon name="add" size={13} /> Duplikovat
            </button>
            {canReopen && (
              <button
                className="inline-flex items-center gap-1.5 font-semibold rounded-full glass-btn text-stone-600 text-[12px] px-3 py-1.5"
                disabled={pending}
                onClick={() => startTransition(async () => { await actionReopenOrder(order.id); router.refresh(); })}
                type="button"
              >
                {pending ? "…" : "Znovu otevřít"}
              </button>
            )}
          </div>
        }
        secondaryRow={
          <>
            {sent && (
              <button
                type="button"
                onClick={() => setShowEmailPreview(true)}
                className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1.5"
              >
                <MIcon name="info" size={12} /> E-mail
              </button>
            )}
            {sent && hasPdf && (
              <a
                href={`/api/orders/${order.id}/pdf?download=1`}
                className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1.5"
              >
                <MIcon name="download" size={12} /> PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowDuplicateConfirm(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 font-semibold rounded-full text-white text-[11px] px-2.5 py-1.5"
              style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
            >
              <MIcon name="add" size={12} /> Duplikovat
            </button>
            {canReopen && (
              <button
                className="inline-flex items-center gap-1 font-semibold rounded-full glass-btn text-stone-600 text-[11px] px-2.5 py-1.5"
                disabled={pending}
                onClick={() => startTransition(async () => { await actionReopenOrder(order.id); router.refresh(); })}
                type="button"
              >
                Znovu otevřít
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">

          {/* Main heading + status */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display font-extrabold text-stone-900 text-[24px] md:text-[28px] leading-tight" style={{ letterSpacing: "-0.01em" }}>
              {formatFullDate(order.date)}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
              style={sent
                ? { background: "rgba(21,128,61,0.12)", color: "#15803d" }
                : { background: "rgba(245,158,11,0.12)", color: "#b45309" }}
            >
              {sent ? <MIcon name="check_circle" size={13} fill /> : <MIcon name="edit" size={13} />}
              {sent ? `Odesláno ${order.sentAt ? new Date(order.sentAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }) : ""}` : "Koncept"}
            </span>
          </div>
          {sent && order.sentAt && (
            <div className="text-[12px] text-stone-500 -mt-2">
              Odesláno {formatSentAt(order.sentAt)}
              {order.extraEmail && <> · Kopie: <span className="text-stone-700">{order.extraEmail}</span></>}
            </div>
          )}

          {/* KPI strip */}
          {!isEmpty && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <KpiCard icon="groups" label="Osob" value={stats.people} />
              <KpiCard icon="local_dining" label="Polévky" value={`${stats.withSoup}/${stats.people}`} />
              <KpiCard icon="restaurant_menu" label="Hlavní jídla" value={stats.mealTotal} />
              <KpiCard icon="payments" label="Suma" value={`${totalPrice} Kč`} />
              <KpiCard icon="trending_up" label="Průměr" value={`${stats.avg} Kč`} sub="na osobu" />
            </div>
          )}

          {/* Dept panels */}
          <div className="grid md:grid-cols-3 gap-4">
            {isEmpty && (
              <div className="glass-card rounded-2xl px-4 py-8 text-[13px] text-stone-400 text-center md:col-span-3">
                Objednávka neobsahuje žádné položky.
              </div>
            )}
            {activeDepts.map((dept) => {
              const activeRows = dept.rows.filter(
                (r) => r.personName || r.soupItem || r.mainItem || r.rollCount > 0
              );
              const dc = DEPT_COLORS[dept.accent] ?? DC_DEFAULT;
              return (
                <section
                  className="glass-card rounded-3xl overflow-hidden"
                  key={dept.name}
                  style={{ borderColor: dc.border }}
                >
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: dc.bg }}>
                    <div
                      className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
                      style={{ background: `${dc.icon}22` }}
                    >
                      <DeptIcon name={dept.name} color={dc.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-[14px] text-stone-900 leading-none">{dept.label}</div>
                      <div className="text-[11.5px] text-stone-500 mt-0.5">
                        {activeRows.length} {pluralOrders(activeRows.length)}
                        {dept.subtotal > 0 && <> · <strong className="text-stone-700">{dept.subtotal} Kč</strong></>}
                      </div>
                    </div>
                  </div>
                  {activeRows.map((row) => (
                    <ReadOnlyRow dc={dc} key={row.id} row={row} />
                  ))}
                </section>
              );
            })}
          </div>

          {duplicateError && (
            <div className="glass-card rounded-2xl px-4 py-3 text-[12.5px] text-red-700 flex items-center gap-2"
                 style={{ borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)" }}>
              <MIcon name="warning" size={14} style={{ color: "#dc2626", flexShrink: 0 }} />
              {duplicateError}
            </div>
          )}
        </div>
      </div>

      {showEmailPreview && (
        <EmailPreviewModal orderId={order.id} onClose={() => setShowEmailPreview(false)} />
      )}
      {showDuplicateConfirm && (
        <ConfirmModal
          title="Duplikovat objednávku?"
          message="Do dnešní objednávky se zkopírují všechna jména (rozdělená podle oddělení). Konkrétní jídla se NEzkopírují — každý si je vybere sám."
          confirmLabel="Duplikovat"
          confirmVariant="primary"
          isPending={pending}
          onClose={() => setShowDuplicateConfirm(false)}
          onConfirm={() => { setShowDuplicateConfirm(false); handleDuplicate(); }}
        />
      )}
    </div>
  );
}
