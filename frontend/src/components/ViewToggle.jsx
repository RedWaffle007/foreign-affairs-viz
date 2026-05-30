export default function ViewToggle({ view, onChange }) {
  const pill = (active) => ({
    padding: "6px 18px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid #0f172a",
    background: active ? "#0f172a" : "#ffffff",
    color: active ? "#ffffff" : "#0f172a",
    transition: "all 0.15s ease",
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "10px 0",
        background: "#ffffff",
      }}
    >
      <div style={{ display: "inline-flex", borderRadius: 9999, overflow: "hidden" }}>
        <button
          style={{ ...pill(view === "bloc"), borderRadius: "9999px 0 0 9999px", borderRight: "none" }}
          onClick={() => onChange("bloc")}
        >
          Bloc View
        </button>
        <button
          style={{ ...pill(view === "network"), borderRadius: "0 9999px 9999px 0" }}
          onClick={() => onChange("network")}
        >
          Network View
        </button>
      </div>
    </div>
  );
}
