export default function Header({ lastUpdated }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: "1.15rem", fontWeight: 700 }}>🌍 Foreign Affairs</span>
        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
          Live relationship tracker — updated daily
        </span>
      </div>
      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
        Last updated: {lastUpdated || "—"}
      </span>
    </header>
  );
}
