import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin, TenantAuthError } from "@/lib/tenant-auth";
import { aggregateOrdersForDate, getWorkingDayNeighbors } from "@/lib/kitchen-aggregation";
import type { KitchenAggregation, TenantSummary } from "@/lib/kitchen-aggregation";
import MIcon from "@/app/components/MIcon";

// ── cached data fetcher ───────────────────────────────────────────────────────

const getAggregation = cache(async (date: string): Promise<KitchenAggregation> => {
  return aggregateOrdersForDate(date);
});

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "long",
  }).replace(/^\w/, (c) => c.toUpperCase());
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <MIcon name={icon} size={22} fill style={{ color }} />
      </div>
      <div>
        <div className="font-display font-bold text-2xl text-stone-900 leading-tight">{value}</div>
        <div className="text-[12px] text-stone-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

function BarChart({ items, maxVal }: { items: { name: string; total: number }[]; maxVal: number }) {
  if (items.length === 0) {
    return <p className="text-[13px] text-stone-400 py-2">Žádná jídla pro tento den.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const pct = maxVal > 0 ? (item.total / maxVal) * 100 : 0;
        const intensity = pct / 100;
        const barColor = intensity > 0.6 ? "#EA580C" : intensity > 0.3 ? "#F59E0B" : "#d6cfc8";
        return (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-[180px] sm:w-[240px] shrink-0 text-[12px] text-stone-700 font-medium truncate">{item.name}</div>
            <div className="flex-1 h-6 rounded-full bg-stone-100 overflow-hidden relative">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <div className="w-8 text-right text-[13px] font-bold text-stone-800 shrink-0">{item.total}×</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: TenantSummary["orderStatus"] }) {
  if (status === "sent") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Odesláno
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Rozepsáno
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 inline-block" />
      Žádné
    </span>
  );
}

function TenantCard({ tenant }: { tenant: TenantSummary }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="font-display font-semibold text-[14px] text-stone-800">{tenant.displayName}</div>
          <div className="text-[11px] text-stone-400">/t/{tenant.slug}</div>
        </div>
        <StatusBadge status={tenant.orderStatus} />
      </div>
      {tenant.orderCount > 0 ? (
        <>
          <div className="flex gap-4 text-[12px] text-stone-500 mb-2">
            <span><strong className="text-stone-800">{tenant.orderCount}</strong> objednávek</span>
            <span><strong className="text-stone-800">{tenant.mealCounts.reduce((s, m) => s + m.count, 0)}</strong> porcí</span>
            {tenant.soupCount > 0 && <span><strong className="text-stone-800">{tenant.soupCount}</strong> polévek</span>}
          </div>
          {tenant.mealCounts.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-stone-100 pt-2 mt-1">
              {tenant.mealCounts.slice(0, 4).map((m) => (
                <div key={m.itemId} className="flex justify-between text-[12px]">
                  <span className="text-stone-600 truncate max-w-[200px]">{m.name}</span>
                  <span className="font-semibold text-stone-800 shrink-0">{m.count}×</span>
                </div>
              ))}
              {tenant.mealCounts.length > 4 && (
                <div className="text-[11px] text-stone-400">+{tenant.mealCounts.length - 4} dalších</div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-[12px] text-stone-400">Zatím žádné objednávky.</p>
      )}
    </div>
  );
}

// ── Suspense sections ─────────────────────────────────────────────────────────

async function KitchenStatCardsSection({ date }: { date: string }) {
  const data = await getAggregation(date);
  const sentCount = data.tenants.filter((t) => t.orderStatus === "sent").length;
  const activeCount = data.tenants.filter((t) => t.orderStatus !== "none").length;
  return (
    <>
      <p className="text-[13px] text-stone-400 mt-0.5 mb-5">
        {sentCount}/{activeCount} firem uzavřelo objednávky
      </p>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Objednávek" value={data.totalOrders} icon="groups" color="#F59E0B" />
        <StatCard label="Porcí jídla" value={data.totalMeals} icon="restaurant" color="#EA580C" />
        <StatCard label="Polévek" value={data.totalSoups} icon="soup_kitchen" color="#4F8A53" />
      </div>
    </>
  );
}

async function KitchenAggregationSection({ date }: { date: string }) {
  const data = await getAggregation(date);
  const maxItemVal = data.perItem[0]?.total ?? 1;
  return (
    <>
      {data.perItem.length > 0 && (
        <section className="glass-soft rounded-2xl p-5 mb-4">
          <h2 className="font-display font-semibold text-[15px] text-stone-800 mb-4 flex items-center gap-2">
            <MIcon name="bar_chart" size={18} className="text-amber-600" />
            Jídla celkem
          </h2>
          <BarChart items={data.perItem} maxVal={maxItemVal} />
        </section>
      )}

      {(data.totalRolls > 0 || data.totalBreadDumplings > 0 || data.totalPotatoDumplings > 0) && (
        <section className="glass-soft rounded-2xl p-5 mb-4">
          <h2 className="font-display font-semibold text-[15px] text-stone-800 mb-3 flex items-center gap-2">
            <MIcon name="bakery_dining" size={18} className="text-amber-600" />
            Přílohy
          </h2>
          <div className="flex flex-wrap gap-6 text-[14px]">
            {data.totalRolls > 0 && <div><span className="text-stone-500">Rohlíky: </span><strong className="text-stone-800">{data.totalRolls}×</strong></div>}
            {data.totalBreadDumplings > 0 && <div><span className="text-stone-500">Houskové knedlíky: </span><strong className="text-stone-800">{data.totalBreadDumplings}×</strong></div>}
            {data.totalPotatoDumplings > 0 && <div><span className="text-stone-500">Bramborové knedlíky: </span><strong className="text-stone-800">{data.totalPotatoDumplings}×</strong></div>}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-semibold text-[15px] text-stone-800 mb-3 flex items-center gap-2">
          <MIcon name="corporate_fare" size={18} className="text-amber-600" />
          Firmy ({data.tenants.length})
        </h2>
        {data.tenants.length === 0 ? (
          <div className="glass-soft rounded-2xl p-8 text-center text-[13px] text-stone-400">
            Žádné aktivní firmy.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.tenants.map((t) => (
              <TenantCard key={t.slug} tenant={t} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ── stat cards skeleton ───────────────────────────────────────────────────────

function StatCardsSkeleton() {
  return (
    <>
      <div style={{ height: 20, width: 200, background: "rgba(0,0,0,0.06)", borderRadius: 6, marginBottom: "1.25rem" }} />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-soft rounded-2xl p-4 flex items-center gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,0,0,0.06)", flexShrink: 0 }} />
            <div>
              <div style={{ height: 28, width: 40, background: "rgba(0,0,0,0.08)", borderRadius: 6 }} />
              <div style={{ height: 12, width: 72, background: "rgba(0,0,0,0.05)", borderRadius: 5, marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AggregationSkeleton() {
  return (
    <div className="glass-soft rounded-2xl p-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-3" style={{ opacity: 1 - i * 0.18 }}>
          <div style={{ width: 180, height: 14, background: "rgba(0,0,0,0.06)", borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, height: 24, background: "rgba(0,0,0,0.05)", borderRadius: 99 }} />
          <div style={{ width: 28, height: 14, background: "rgba(0,0,0,0.06)", borderRadius: 5, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function KuchynePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof TenantAuthError) redirect("/super-admin/login");
    throw e;
  }

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;
  const { prev, next } = getWorkingDayNeighbors(date);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Header + day picker */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="font-display font-bold text-[20px] text-stone-900">Přehled kuchyně</h1>
        <div className="flex items-center gap-2 glass-soft rounded-2xl px-3 py-2">
          <Link href={`/kuchyne?date=${prev}`} className="p-1 rounded-lg hover:bg-stone-100 transition-colors text-stone-500 hover:text-stone-700">
            <MIcon name="chevron_left" size={20} />
          </Link>
          <span className="text-[13px] font-semibold text-stone-700 min-w-[160px] text-center">
            {formatDate(date)}
          </span>
          <Link href={`/kuchyne?date=${next}`} className="p-1 rounded-lg hover:bg-stone-100 transition-colors text-stone-500 hover:text-stone-700">
            <MIcon name="chevron_right" size={20} />
          </Link>
        </div>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <KitchenStatCardsSection date={date} />
      </Suspense>

      <Suspense fallback={<AggregationSkeleton />}>
        <KitchenAggregationSection date={date} />
      </Suspense>
    </div>
  );
}
