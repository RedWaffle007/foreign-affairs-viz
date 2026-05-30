import { eventBadge, getFlagEmoji, sentimentColor } from "../utils";

export default function EventFeed({ events, open, onToggle }) {
  const all = events || [];

  return (
    <aside
      style={{
        width: open ? 300 : 44,
        flexShrink: 0,
        height: "100%",
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s ease",
      }}
    >
      {!open ? (
        // Collapsed: a vertical tab on the left edge.
        <button
          onClick={() => onToggle(true)}
          title="Open Recent Events"
          style={{
            width: 44,
            height: "100%",
            border: "none",
            background: "#0f172a",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.8rem",
            letterSpacing: "0.05em",
            writingMode: "vertical-rl",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 0",
          }}
        >
          📰 Recent Events
        </button>
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "#0f172a",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
              📰 Recent Events
            </span>
            <button
              onClick={() => onToggle(false)}
              title="Collapse"
              style={{
                border: "none",
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "1rem",
                lineHeight: 1,
                padding: 2,
              }}
            >
              ◀
            </button>
          </div>

          {/* Scrollable event feed — cards show the full summary, variable height */}
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {all.length === 0 && (
              <p style={{ color: "#94a3b8", padding: 8, fontSize: "0.75rem" }}>
                No events yet.
              </p>
            )}
            {all.map((ev) => {
              const badge = eventBadge(ev.event_type);
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: "8px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>{getFlagEmoji(ev.country_a)}</span>
                    <span style={{ fontSize: "0.78rem" }}>{ev.country_a}</span>
                    <span style={{ color: "#94a3b8" }}>↔</span>
                    <span>{getFlagEmoji(ev.country_b)}</span>
                    <span style={{ fontSize: "0.78rem" }}>{ev.country_b}</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: sentimentColor(ev.sentiment_score),
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: badge.bg,
                        color: badge.text,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {badge.label}
                    </span>
                    {/* Full summary — no truncation, wraps to as many lines as needed */}
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "#475569",
                        lineHeight: 1.45,
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {ev.summary}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
