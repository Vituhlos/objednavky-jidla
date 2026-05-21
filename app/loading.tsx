export default function Loading() {
  return (
    <div className="k-shell">
      {/* Desktop topbar */}
      <div className="hidden md:flex px-5 py-2 border-b border-white/50 items-center gap-4 topbar shrink-0">
        <div className="h-3.5 w-52 rounded-full shimmer" />
        <div className="ml-auto h-3.5 w-28 rounded-full shimmer" />
      </div>
      {/* Mobile topbar */}
      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full shimmer shrink-0" />
        <div className="h-3.5 w-36 rounded-full shimmer" />
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-4">
        <div className="flex flex-col gap-4 pb-20">
          {/* Day picker */}
          <div className="h-10 w-full md:w-72 rounded-2xl shimmer" />

          {/* Department panels */}
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass rounded-3xl overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/40">
                  <div className="w-9 h-9 rounded-xl shrink-0 shimmer" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-3.5 w-24 rounded-full shimmer" />
                    <div className="h-3 w-16 rounded-full shimmer" />
                  </div>
                  <div className="h-7 w-16 rounded-full shimmer shrink-0" />
                </div>
                {/* Skeleton rows */}
                {[0, 1].map((j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-white/30 last:border-0">
                    <div className="w-[34px] h-[34px] rounded-full shrink-0 shimmer" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-28 rounded-full shimmer" />
                      <div className="h-2.5 w-44 rounded-full shimmer" />
                    </div>
                    <div className="h-3.5 w-12 rounded-full shimmer shrink-0" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
