"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderSummaryWithDepts, HistoryStats, CalendarDay } from "@/lib/orders";
import type { PizzaOrderSummary } from "@/lib/pizza";
import type { DepartmentInfo } from "@/lib/departments";
import MIcon from "./MIcon";
import PageHeader from "./PageHeader";
import { useSwipeReveal } from "@/app/hooks/useSwipeReveal";
import { getCalendarHeatmap } from "@/app/actions";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_CS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MONTHS_CS_LONG = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const MONTHS_CS_SHORT = ["led", "úno", "bře", "dub", "kvě", "čer", "čvc", "srp", "zář", "říj", "lis", "pro"];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatDayShort(iso: string): { dow: string; dm: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = DAYS_CS[new Date(y, m - 1, d).getDay()];
  return { dow, dm: `${d}.${m}.` };
}

function formatSentAt(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric", month: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getPragueTodayISO(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getISOWeekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dow - 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function getWeekLabel(weekStart: string, todayWeekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const range = `${monday.getDate()}.–${friday.getDate()}. ${friday.getMonth() + 1}. ${friday.getFullYear()}`;

  const today = new Date(todayWeekStart.split("-").map(Number).reduce((a) => a, 0));
  void today;
  const todayDate = new Date(todayWeekStart);
  const diffDays = Math.round((monday.getTime() - todayDate.getTime()) / 86400000);
  if (diffDays === 0) return `Tento týden · ${range}`;
  if (diffDays === -7) return `Minulý týden · ${range}`;
  if (diffDays === -14) return `Předminulý týden · ${range}`;
  return `${range}`;
}

function pluralPeople(n: number): string {
  if (n === 1) return "osoba";
  if (n >= 2 && n <= 4) return "osoby";
  return "osob";
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, trend }: { icon: string; label: string; value: string | number; sub?: string; trend?: { dir: "up" | "down" | "flat"; text: string } }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__icon">
        <MIcon name={icon} size={15} fill />
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__value">{value}</span>
        {trend && (
          <span className={`kpi-card__trend kpi-card__trend--${trend.dir}`}>
            <MIcon name={trend.dir === "up" ? "trending_up" : trend.dir === "down" ? "trending_down" : "trending_flat"} size={12} />
            {trend.text}
          </span>
        )}
        {!trend && sub && <span className="kpi-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

// ── Dept badge ───────────────────────────────────────────────────────────────

function DeptBadges({ depts, deptInfo }: { depts: string[]; deptInfo: Map<string, DepartmentInfo> }) {
  return (
    <span className="history-row__depts">
      {depts.map((name) => {
        const info = deptInfo.get(name);
        const accent = info?.accent ?? "blue";
        const label = info?.label ?? name;
        const letter = label.charAt(0).toUpperCase();
        return (
          <span key={name} className={`dept-badge dept-badge--${accent}`} title={label}>
            {letter}
          </span>
        );
      })}
    </span>
  );
}

// ── Swipeable row (mobile, simplified) ───────────────────────────────────────

const REVEAL_W = 76;

function SwipeableHistoryRow({
  href, date, status, isDraft, peopleCount, totalPrice, sentAt,
  depts, deptInfo, isActive,
}: {
  href: string;
  date: string;
  status: string;
  isDraft: boolean;
  peopleCount: number;
  totalPrice: number;
  sentAt: string | null;
  depts: string[];
  deptInfo: Map<string, DepartmentInfo>;
  isActive: boolean;
}) {
  const router = useRouter();
  const { containerRef, swipedRef, revealedRef, close } = useSwipeReveal(REVEAL_W);

  const handleContentClick = () => {
    if (swipedRef.current) return;
    if (revealedRef.current) { close(); return; }
    router.push(href);
  };

  const { dow, dm } = formatDayShort(date);

  return (
    <div
      ref={containerRef as React.RefCallback<HTMLDivElement>}
      className={`relative overflow-hidden border-b border-white/30 last:border-0 select-none touch-pan-y ${isDraft ? "opacity-70" : ""}`}
      style={isActive ? { background: "rgba(245,158,11,0.07)", borderLeft: "3px solid #EA580C" } : undefined}
    >
      <div
        data-swipe-reveal
        aria-hidden
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: REVEAL_W, background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}
      >
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-bold w-full h-full"
          onClick={(e) => { e.stopPropagation(); router.push(href); }}
        >
          <MIcon name="arrow_forward" size={16} style={{ color: "white" }} />
          Otevřít
        </button>
      </div>
      <div
        data-swipe-content
        className="flex items-center px-4 py-3 gap-3 cursor-pointer active:bg-white/50 transition-colors bg-white/0"
        onClick={handleContentClick}
      >
        <div className="shrink-0">
          <div className="text-[10px] uppercase font-bold text-stone-500 leading-none">{dow}</div>
          <div className="font-display font-bold text-[14px] text-stone-900 leading-none mt-0.5">{dm}</div>
        </div>
        <DeptBadges depts={depts} deptInfo={deptInfo} />
        <div className="flex-1" />
        <div className="text-right shrink-0">
          <div className="text-[12.5px] font-semibold text-stone-900">{peopleCount} {pluralPeople(peopleCount)}</div>
          {totalPrice > 0 && <div className="text-[11px] text-stone-500">{totalPrice} Kč</div>}
        </div>
        {status === "sent" ? (
          <span className="history-row__status history-row__status--sent">
            <MIcon name="check_circle" size={10} fill /> {sentAt ? formatSentAt(sentAt).split(" ").slice(-1)[0] : ""}
          </span>
        ) : (
          <span className="history-row__status history-row__status--active">
            <span className="dot" /> Aktivní
          </span>
        )}
      </div>
    </div>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number): Array<{ date: string; day: number; isCurrentMonth: boolean; dow: number }> {
  const first = new Date(year, month - 1, 1);
  const firstDow = first.getDay() || 7; // Mon=1, Sun=7
  const startOffset = firstDow - 1;
  const days: Array<{ date: string; day: number; isCurrentMonth: boolean; dow: number }> = [];
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: iso,
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === month - 1,
      dow: d.getDay() || 7,
    });
  }
  // Trim trailing whole-week rows that contain only out-of-month days
  while (days.length >= 35 && days.slice(-7).every((x) => !x.isCurrentMonth)) {
    days.splice(-7, 7);
  }
  return days;
}

function getLevel(count: number): "" | "l1" | "l2" | "l3" | "l4" {
  if (count <= 0) return "";
  if (count <= 5) return "l1";
  if (count <= 10) return "l2";
  if (count <= 15) return "l3";
  return "l4";
}

function CalendarHeatmap({ initial, initialYear, initialMonth, onSelectDate }: {
  initial: CalendarDay[];
  initialYear: number;
  initialMonth: number;
  onSelectDate: (date: string | null) => void;
}) {
  const today = getPragueTodayISO();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<CalendarDay[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dataMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const handleMonthChange = useCallback((delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
    startTransition(async () => {
      const next = await getCalendarHeatmap(newYear, newMonth);
      setData(next);
    });
  }, [year, month]);

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const handleClick = (iso: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    const next = selected === iso ? null : iso;
    setSelected(next);
    onSelectDate(next);
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => handleMonthChange(-1)}
          className="w-7 h-7 rounded-full glass-btn inline-flex items-center justify-center text-stone-500"
          aria-label="Předchozí měsíc"
        >
          <MIcon name="chevron_left" size={14} />
        </button>
        <div className="font-display font-bold text-[13px] text-stone-900">
          {MONTHS_CS_LONG[month - 1].charAt(0).toUpperCase() + MONTHS_CS_LONG[month - 1].slice(1)} {year}
        </div>
        <button
          type="button"
          onClick={() => handleMonthChange(1)}
          className="w-7 h-7 rounded-full glass-btn inline-flex items-center justify-center text-stone-500"
          aria-label="Další měsíc"
        >
          <MIcon name="chevron_right" size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["Po","Út","St","Čt","Pá","So","Ne"].map((d) => (
          <div key={d} className="text-[9.5px] font-bold uppercase text-stone-400 text-center" style={{ letterSpacing: "0.05em" }}>{d}</div>
        ))}
      </div>
      <div className="heatmap-grid">
        {days.map((d) => {
          const cell = dataMap.get(d.date);
          const lvl = cell ? getLevel(cell.peopleCount) : "";
          const isToday = d.date === today;
          const isSelected = d.date === selected;
          const classes = [
            "heatmap-cell",
            !d.isCurrentMonth ? "heatmap-cell--outside" : "",
            lvl ? `heatmap-cell--${lvl}` : "",
            isToday ? "heatmap-cell--today" : "",
            isSelected ? "heatmap-cell--selected" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={d.date}
              type="button"
              className={classes}
              onClick={() => handleClick(d.date, d.isCurrentMonth)}
              title={cell ? `${cell.peopleCount} osob · ${cell.totalPrice} Kč` : (d.isCurrentMonth ? "Bez objednávek" : "")}
              disabled={!d.isCurrentMonth}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      <div className="heatmap-legend">
        <span>Méně</span>
        <span className="heatmap-legend__swatches">
          <span style={{ background: "rgba(26,18,8,0.04)" }} />
          <span style={{ background: "rgba(245,158,11,0.15)" }} />
          <span style={{ background: "rgba(245,158,11,0.30)" }} />
          <span style={{ background: "rgba(245,158,11,0.45)" }} />
          <span style={{ background: "rgba(245,158,11,0.60)" }} />
        </span>
        <span>Více</span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function HistoryPage({
  orders,
  pizzaOrders,
  pizzaEnabled = true,
  stats,
  initialHeatmap,
  initialYear,
  initialMonth,
  departments,
}: {
  orders: OrderSummaryWithDepts[];
  pizzaOrders: PizzaOrderSummary[];
  pizzaEnabled?: boolean;
  stats: HistoryStats;
  initialHeatmap: CalendarDay[];
  initialYear: number;
  initialMonth: number;
  departments: DepartmentInfo[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string | null>(null); // "YYYY-MM" or null = all
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const today = getPragueTodayISO();
  const todayWeekStart = getISOWeekStart(today);

  // ⌘K / Ctrl+K shortcut — detekce platformy pro správný label
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Build dept info map
  const deptInfo = useMemo(() => {
    const m = new Map<string, DepartmentInfo>();
    for (const d of departments) m.set(d.name, d);
    return m;
  }, [departments]);

  // Build month buckets
  const monthBuckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (o.status !== "sent") continue;
      const ym = o.date.slice(0, 7);
      counts.set(ym, (counts.get(ym) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
  }, [orders]);

  // Filter
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    let res = orders;
    if (hideEmpty) res = res.filter((o) => o.status === "sent" || o.rowCount > 0);
    if (filterMonth) res = res.filter((o) => o.date.startsWith(filterMonth));
    if (filterDept) res = res.filter((o) => o.depts.includes(filterDept));
    if (q) {
      res = res.filter((o) => {
        if (formatDate(o.date).toLowerCase().includes(q)) return true;
        if ((o.extraEmail ?? "").toLowerCase().includes(q)) return true;
        // Month names (czech)
        const monthIdx = parseInt(o.date.slice(5, 7), 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          if (MONTHS_CS_LONG[monthIdx].includes(q) || MONTHS_CS_SHORT[monthIdx].includes(q)) return true;
        }
        // Day name
        const [y, m, d] = o.date.split("-").map(Number);
        const dow = DAYS_CS[new Date(y, m - 1, d).getDay()].toLowerCase();
        if (dow.includes(q)) return true;
        // Department name
        for (const deptName of o.depts) {
          const info = deptInfo.get(deptName);
          if ((info?.label ?? deptName).toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    return res;
  }, [orders, hideEmpty, filterMonth, filterDept, q, deptInfo]);

  // Group by week
  const weekGroups = useMemo(() => {
    const groups = new Map<string, OrderSummaryWithDepts[]>();
    for (const o of filtered) {
      const ws = getISOWeekStart(o.date);
      if (!groups.has(ws)) groups.set(ws, []);
      groups.get(ws)!.push(o);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Selected day card
  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    const o = orders.find((x) => x.date === selectedDate);
    return o ?? { date: selectedDate, peopleCount: 0, totalPrice: 0, depts: [], status: "draft" as const, id: 0, sentAt: null, extraEmail: null, rowCount: 0 };
  }, [selectedDate, orders]);

  const trend = stats.monthlyOrderCountPrev > 0
    ? (() => {
        const delta = stats.monthlyOrderCount - stats.monthlyOrderCountPrev;
        const dir = delta > 0 ? "up" as const : delta < 0 ? "down" as const : "flat" as const;
        return { dir, text: `${delta > 0 ? "+" : ""}${delta} vs ${MONTHS_CS_SHORT[(initialMonth - 2 + 12) % 12]}` };
      })()
    : undefined;

  const sentCount = orders.filter((o) => o.status === "sent").length;
  const pizzaSentCount = pizzaOrders.filter((o) => o.status === "sent").length;

  return (
    <div className="k-shell">
      <PageHeader
        title="Historie objednávek"
        mobileTitle="Historie"
        meta={
          <span className="hidden md:inline text-[12px]">
            <strong className="text-stone-700">{sentCount}</strong> obědů
            {pizzaEnabled && <> · <strong className="text-stone-700">{pizzaSentCount}</strong> pizz</>}
          </span>
        }
        actions={
          <div className="search-pill hidden md:inline-flex">
            <MIcon name="search" size={14} style={{ color: "#a8a29e" }} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Hledat (datum, jméno, jídlo, e-mail)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="search-pill__kbd" aria-label={isMac ? "Command K" : "Ctrl K"}>
              {isMac ? "⌘ K" : "Ctrl K"}
            </span>
          </div>
        }
        searchBar={
          <input
            className="modal-input !py-1.5 !text-[12px] w-full"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat…"
            type="search"
            value={search}
          />
        }
      />

      <div className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 pb-nav">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <KpiCard
              icon="calendar_month"
              label="Tento měsíc"
              value={stats.monthlyOrderCount}
              sub={stats.monthlyOrderCount === 1 ? "objednávka" : stats.monthlyOrderCount < 5 ? "objednávky" : "objednávek"}
              trend={trend}
            />
            <KpiCard icon="groups" label="Lidé" value={stats.monthlyPeopleCount} sub="obědů celkem" />
            <KpiCard icon="payments" label="Suma" value={`${stats.monthlySum.toLocaleString("cs-CZ")} Kč`} />
            <KpiCard icon="trending_up" label="Průměr" value={`${stats.monthlyAvgPeoplePerDay}`} sub="osob/den" />
          </div>

          {/* Filter chipy */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className={`filter-chip${filterMonth === null ? " active" : ""}`}
              onClick={() => setFilterMonth(null)}
            >
              Vše
              <span className="filter-chip__count">{orders.filter((o) => o.status === "sent").length}</span>
            </button>
            {monthBuckets.map(([ym, count]) => {
              const monthIdx = parseInt(ym.slice(5), 10) - 1;
              const label = MONTHS_CS_LONG[monthIdx];
              return (
                <button
                  key={ym}
                  type="button"
                  className={`filter-chip${filterMonth === ym ? " active" : ""}`}
                  onClick={() => setFilterMonth(ym)}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                  <span className="filter-chip__count">{count}</span>
                </button>
              );
            })}
            {departments.length > 0 && (
              <>
                <span className="h-5 w-px bg-stone-300 mx-1" aria-hidden />
                {departments.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className={`filter-chip${filterDept === d.name ? " active" : ""}`}
                    onClick={() => setFilterDept(filterDept === d.name ? null : d.name)}
                  >
                    <span className={`dept-badge dept-badge--${d.accent}`} style={{ width: 14, height: 14, fontSize: 8 }}>
                      {d.label.charAt(0).toUpperCase()}
                    </span>
                    {d.label}
                  </button>
                ))}
              </>
            )}
            <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none">
              <div className="relative shrink-0">
                <input checked={hideEmpty} className="peer sr-only" onChange={(e) => setHideEmpty(e.target.checked)} type="checkbox" />
                <div className="w-8 h-[18px] rounded-full bg-black/15 transition-colors peer-checked:[background:linear-gradient(135deg,#F59E0B,#EA580C)]" />
                <div className="absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
              </div>
              <span className="text-[11.5px] text-stone-600">Skrýt prázdné koncepty</span>
            </label>
          </div>

          {/* Main grid: list + calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">

            {/* LIMA orders list */}
            <section className="glass-card rounded-3xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(59,130,246,0.07)" }}>
                <MIcon name="restaurant_menu" size={17} fill style={{ color: "#3B82F6" }} />
                <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Obědy LIMA</span>
                <span className="text-[11px] text-stone-500">{filtered.length} záznamů</span>
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <MIcon name="history" size={22} style={{ color: "#94a3b8" }} />
                  </div>
                  <p className="empty-state__title">{q || filterDept || filterMonth ? "Žádné výsledky" : "Zatím žádné objednávky"}</p>
                  {(q || filterDept || filterMonth) && <p className="empty-state__sub">Zkus jiný filtr</p>}
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="md:hidden">
                    {weekGroups.map(([weekStart, items]) => (
                      <div key={weekStart}>
                        <div className="week-header">
                          <span>{getWeekLabel(weekStart, todayWeekStart)}</span>
                          <span className="week-header__sum">
                            {items.reduce((s, x) => s + x.peopleCount, 0)} osob ·{" "}
                            {items.reduce((s, x) => s + x.totalPrice, 0).toLocaleString("cs-CZ")} Kč
                          </span>
                        </div>
                        {items.map((o) => (
                          <SwipeableHistoryRow
                            key={o.id}
                            href={`/historie/${o.id}`}
                            date={o.date}
                            status={o.status}
                            isDraft={o.status !== "sent"}
                            peopleCount={o.peopleCount}
                            totalPrice={o.totalPrice}
                            sentAt={o.sentAt}
                            depts={o.depts}
                            deptInfo={deptInfo}
                            isActive={o.date === today && o.status !== "sent"}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block">
                    {weekGroups.map(([weekStart, items]) => (
                      <div key={weekStart}>
                        <div className="week-header">
                          <span>{getWeekLabel(weekStart, todayWeekStart)}</span>
                          <span className="week-header__sum">
                            {items.reduce((s, x) => s + x.peopleCount, 0)} osob ·{" "}
                            {items.reduce((s, x) => s + x.totalPrice, 0).toLocaleString("cs-CZ")} Kč
                          </span>
                        </div>
                        {items.map((o) => {
                          const isActive = o.date === today && o.status !== "sent";
                          const { dow, dm } = formatDayShort(o.date);
                          return (
                            <div
                              key={o.id}
                              role="link"
                              tabIndex={0}
                              className={`history-row${isActive ? " history-row--active" : ""}`}
                              onClick={() => router.push(`/historie/${o.id}`)}
                              onKeyDown={(e) => e.key === "Enter" && router.push(`/historie/${o.id}`)}
                            >
                              <div>
                                <div className="text-[10px] uppercase font-bold text-stone-500 leading-none">{dow}</div>
                                <div className="font-display font-bold text-[15px] text-stone-900 leading-none mt-1">{dm}</div>
                              </div>
                              {o.status === "sent" ? (
                                <span className="history-row__status history-row__status--sent">
                                  <MIcon name="check_circle" size={10} fill /> Odesláno
                                </span>
                              ) : (
                                <span className="history-row__status history-row__status--active">
                                  <span className="dot" /> Aktivní
                                </span>
                              )}
                              <DeptBadges depts={o.depts} deptInfo={deptInfo} />
                              <span className="history-row__count">{o.peopleCount} osob</span>
                              <span className="history-row__price">{o.totalPrice > 0 ? `${o.totalPrice.toLocaleString("cs-CZ")} Kč` : "—"}</span>
                              <span className="history-row__time">{o.sentAt ? formatSentAt(o.sentAt).split(" ").slice(-1)[0] : (isActive ? "Aktivní" : "—")}</span>
                              <MIcon name="chevron_right" size={16} style={{ color: "#d4c5b5" }} />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Calendar (desktop only — wraps under list on mobile/tablet) */}
            <aside className="hidden lg:flex flex-col gap-3 sticky top-4">
              <CalendarHeatmap
                initial={initialHeatmap}
                initialYear={initialYear}
                initialMonth={initialMonth}
                onSelectDate={setSelectedDate}
              />
              {selectedDayData && (
                <div className="glass-card rounded-2xl p-4 fade-up">
                  <div className="text-[10.5px] uppercase font-bold text-stone-500" style={{ letterSpacing: "0.06em" }}>Vybraný den</div>
                  <div className="font-display font-bold text-[16px] text-stone-900 mt-1">
                    {(() => { const { dow, dm } = formatDayShort(selectedDayData.date); return `${dow} ${dm}`; })()}
                  </div>
                  {selectedDayData.peopleCount > 0 ? (
                    <>
                      <div className="text-[12.5px] text-stone-700 mt-2">
                        <strong>{selectedDayData.peopleCount}</strong> {pluralPeople(selectedDayData.peopleCount)} ·{" "}
                        <strong>{selectedDayData.totalPrice.toLocaleString("cs-CZ")} Kč</strong>
                      </div>
                      <DeptBadges depts={(selectedDayData as OrderSummaryWithDepts).depts ?? []} deptInfo={deptInfo} />
                      {selectedDayData.id > 0 && (
                        <button
                          type="button"
                          onClick={() => router.push(`/historie/${selectedDayData.id}`)}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 font-semibold rounded-full text-white text-[12px] py-2"
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 4px 12px -4px rgba(245,158,11,0.4)" }}
                        >
                          Otevřít detail <MIcon name="arrow_forward" size={13} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-[12px] text-stone-400 mt-2">Bez objednávek</div>
                  )}
                </div>
              )}
            </aside>
          </div>

          {/* Pizza orders (under main) */}
          {pizzaEnabled && pizzaOrders.length > 0 && (
            <section className="glass-card rounded-3xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/40" style={{ background: "rgba(234,88,12,0.07)" }}>
                <MIcon name="local_pizza" size={17} fill style={{ color: "#EA580C" }} />
                <span className="font-display font-bold text-[13.5px] text-stone-900 flex-1">Pizza</span>
                <span className="text-[11px] text-stone-500">{pizzaOrders.length} záznamů · {pizzaSentCount} odesláno</span>
              </div>
              <div className="overflow-x-auto">
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
                    {pizzaOrders.map((o) => (
                      <tr
                        key={o.id}
                        className={`border-b border-white/30 last:border-0 hover:bg-white/60 active:bg-white/80 transition cursor-pointer select-none ${o.status !== "sent" ? "opacity-60" : ""}`}
                        onClick={() => router.push(`/historie/pizza/${o.id}`)}
                        role="link"
                        tabIndex={0}
                      >
                        <td className="px-4 py-3 font-semibold text-stone-800">{formatDate(o.date)}</td>
                        <td className="px-3 py-3">
                          <span className={o.status === "sent" ? "history-row__status history-row__status--sent" : "history-row__status history-row__status--active"}>
                            {o.status === "sent" ? <><MIcon name="check_circle" size={10} fill /> Odesláno</> : <><span className="dot" /> Aktivní</>}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-stone-500">{formatSentAt(o.sentAt)}</td>
                        <td className="px-3 py-3 text-stone-500">{o.rowCount}</td>
                        <td className="px-3 py-3 text-stone-400">
                          <MIcon name="chevron_right" size={16} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
