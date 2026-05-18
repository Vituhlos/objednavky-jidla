"use client";

import { useParams } from "next/navigation";

function getDisplayInfo(tenantSlug: string) {
  const name = tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1).replace(/-/g, " ");
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return { name, initials };
}

export default function TenantAuthShell({
  children,
  headerExtra,
}: {
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const params = useParams<{ tenantSlug?: string }>();
  const { name, initials } = getDisplayInfo(params.tenantSlug ?? "kantyna");

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className="stage-bg" aria-hidden>
        <div className="orb orb-sky" />
        <div className="orb orb-amber" />
        <div className="orb orb-mint" />
        <div className="orb orb-rose" />
      </div>
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 py-6 overflow-y-auto scroll-area">
        <div className="w-full max-w-[420px] fade-up">
          <div className="flex flex-col items-center gap-3 mb-5">
            <span
              className="inline-flex items-center justify-center rounded-2xl font-display font-extrabold text-white text-[19px]"
              style={{
                width: 56, height: 56,
                background: "linear-gradient(135deg, #F59E0B, #EA580C)",
                boxShadow: "0 14px 32px -10px rgba(234,88,12,0.55), 0 1px 0 rgba(255,255,255,0.35) inset",
              }}
            >
              {initials}
            </span>
            <div className="text-center">
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-amber-700/80">Kantýna</div>
              <div className="font-display font-extrabold text-[18px] text-slate-900 leading-tight">{name}</div>
            </div>
            {headerExtra}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
