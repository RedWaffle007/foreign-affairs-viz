export default function SentimentLegend() {
  const row = (color, label) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
      <span style={{ width: 22, height: 0, borderTop: `2px solid ${color}` }} />
      <span style={{ color: "#475569" }}>{label}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        Relationship Key
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {row("#16a34a", "Friendly (>0.3)")}
        {row("#dc2626", "Hostile (<-0.3)")}
        {row("#94a3b8", "Neutral")}
      </div>
    </div>
  );
}
