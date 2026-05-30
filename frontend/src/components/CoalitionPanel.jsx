import { getFlagEmoji, sentimentColor } from "../utils";

const panelStyle = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: 300,
  background: "#ffffff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
  zIndex: 30,
  display: "flex",
  flexDirection: "column",
  animation: "slideInRight 0.2s ease-out",
};

export default function CoalitionPanel({ coalition, graphData, onClose }) {
  if (!coalition) return null;
  const { name, color, description, members } = coalition;

  // Average sentiment across intra-coalition relationships.
  const memberSet = new Set(members);
  const intra = (graphData?.links || []).filter(
    (l) =>
      memberSet.has(l.source?.id || l.source) &&
      memberSet.has(l.target?.id || l.target)
  );
  const avg =
    intra.length > 0
      ? intra.reduce((s, l) => s + (l.sentiment_score ?? l.sentiment ?? 0), 0) /
        intra.length
      : null;

  return (
    <div style={panelStyle}>
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e2e8f0",
          borderLeft: `4px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700 }}>{name}</h2>
        <button onClick={onClose} style={closeBtn}>
          ✕
        </button>
      </div>

      <div style={{ padding: 18, overflowY: "auto" }}>
        <p style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
          {description}
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Stat label="Members" value={members.length} />
          <Stat
            label="Avg sentiment"
            value={avg === null ? "—" : avg.toFixed(2)}
            color={avg === null ? "#0f172a" : sentimentColor(avg)}
          />
        </div>

        <h3 style={sectionTitle}>Member Countries</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {members.map((m) => (
            <div
              key={m}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                background: "#f8fafc",
                borderRadius: 6,
                fontSize: "0.82rem",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{getFlagEmoji(m)}</span>
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "#0f172a" }) {
  return (
    <div>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

const sectionTitle = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
  marginBottom: 8,
};

const closeBtn = {
  background: "none",
  border: "none",
  fontSize: "1.1rem",
  cursor: "pointer",
  color: "#94a3b8",
  lineHeight: 1,
};
