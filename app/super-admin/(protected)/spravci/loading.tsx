export default function SpravciLoading() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ height: 28, width: 200, background: "rgba(22,50,74,0.08)", borderRadius: 8 }} />
          <div style={{ height: 16, width: 140, background: "rgba(22,50,74,0.05)", borderRadius: 6, marginTop: 6 }} />
        </div>
        <div style={{ height: 36, width: 150, background: "rgba(22,50,74,0.08)", borderRadius: 20 }} />
      </div>
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--sand)", opacity: 1 - i * 0.2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(22,50,74,0.08)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 16, width: "50%", background: "rgba(0,0,0,0.07)", borderRadius: 6 }} />
            </div>
            <div style={{ height: 14, width: 64, background: "rgba(0,0,0,0.05)", borderRadius: 5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
