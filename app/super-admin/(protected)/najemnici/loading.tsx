export default function NajemniciLoading() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ height: 28, width: 120, background: "rgba(22,50,74,0.08)", borderRadius: 8 }} />
          <div style={{ height: 16, width: 160, background: "rgba(22,50,74,0.05)", borderRadius: 6, marginTop: 6 }} />
        </div>
        <div style={{ height: 36, width: 130, background: "rgba(22,50,74,0.08)", borderRadius: 20 }} />
      </div>
      <div className="glass" style={{ borderRadius: 16, overflow: "hidden" }}>
        <div style={{ borderBottom: "2px solid var(--sand)", padding: "0.65rem 0.5rem", display: "flex", gap: "0.5rem" }}>
          {[2, 1.5, 0.5, 0.8, 1].map((w, i) => (
            <div key={i} style={{ height: 14, flex: w, background: "rgba(22,50,74,0.08)", borderRadius: 6 }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 0.5rem", borderBottom: "1px solid var(--sand)", opacity: 1 - i * 0.12 }}>
            <div style={{ flex: 2 }}>
              <div style={{ height: 16, width: "70%", background: "rgba(0,0,0,0.06)", borderRadius: 6 }} />
              <div style={{ height: 12, width: "45%", background: "rgba(0,0,0,0.04)", borderRadius: 5, marginTop: 4 }} />
            </div>
            <div style={{ flex: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ height: 22, width: 90, background: "rgba(0,0,0,0.05)", borderRadius: 6 }} />
            </div>
            <div style={{ flex: 0.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ height: 16, width: 24, background: "rgba(0,0,0,0.05)", borderRadius: 5 }} />
            </div>
            <div style={{ flex: 0.8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ height: 22, width: 60, background: "rgba(0,0,0,0.05)", borderRadius: 20 }} />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ height: 14, width: 64, background: "rgba(0,0,0,0.04)", borderRadius: 5 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
