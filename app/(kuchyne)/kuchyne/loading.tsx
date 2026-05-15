export default function KuchyneLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="h-6 w-48 bg-stone-200 rounded-xl mb-1" />
          <div className="h-4 w-32 bg-stone-100 rounded-xl" />
        </div>
        <div className="h-10 w-52 bg-stone-200 rounded-2xl" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-soft rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-200 shrink-0" />
            <div>
              <div className="h-7 w-10 bg-stone-200 rounded-lg mb-1" />
              <div className="h-3 w-20 bg-stone-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart skeleton */}
      <div className="glass-soft rounded-2xl p-5 mb-4">
        <div className="h-5 w-28 bg-stone-200 rounded-lg mb-4" />
        <div className="flex flex-col gap-3">
          {[85, 60, 40, 25].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-[200px] h-4 bg-stone-200 rounded-lg shrink-0" />
              <div className="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-stone-200 rounded-full" style={{ width: `${w}%` }} />
              </div>
              <div className="w-8 h-4 bg-stone-200 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Tenant cards skeleton */}
      <div className="h-5 w-24 bg-stone-200 rounded-lg mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-soft rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="h-4 w-32 bg-stone-200 rounded-lg mb-1" />
                <div className="h-3 w-16 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-5 w-20 bg-stone-100 rounded-full" />
            </div>
            <div className="flex gap-4 mb-2">
              <div className="h-3 w-24 bg-stone-100 rounded-lg" />
              <div className="h-3 w-20 bg-stone-100 rounded-lg" />
            </div>
            <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
              {[0, 1].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-3 w-36 bg-stone-100 rounded-lg" />
                  <div className="h-3 w-6 bg-stone-100 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
