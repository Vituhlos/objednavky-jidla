export default function AdminLoading() {
  return (
    <div className="k-shell animate-pulse">
      <div className="v2-content max-w-3xl mx-auto pb-24">
        <div className="flex items-center gap-2 mb-5 mt-2">
          <div className="w-5 h-5 rounded bg-stone-200" />
          <div className="h-6 w-48 bg-stone-200 rounded-xl" />
        </div>
        {/* Tab bar skeleton */}
        <div className="flex gap-1 mb-5 bg-stone-100 rounded-2xl p-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 bg-stone-200 rounded-xl" />
          ))}
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-soft rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-stone-200 shrink-0" />
              <div>
                <div className="h-6 w-8 bg-stone-200 rounded-lg mb-1" />
                <div className="h-3 w-24 bg-stone-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
        {/* Join URL skeleton */}
        <div className="glass-soft rounded-2xl p-5">
          <div className="h-4 w-40 bg-stone-200 rounded-lg mb-3" />
          <div className="h-10 bg-stone-100 rounded-xl mb-3" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-stone-200 rounded-xl" />
            <div className="h-8 w-24 bg-stone-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
