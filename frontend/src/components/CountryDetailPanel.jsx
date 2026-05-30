import { useEffect, useState } from "react";
import { fetchEvents } from "../api";
import { eventBadge, getFlagEmoji, sentimentColor } from "../utils";

const panelStyle = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: 320,
  background: "#ffffff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
  zIndex: 30,
  display: "flex",
  flexDirection: "column",
  animation: "slideInRight 0.2s ease-out",
};

function relationsFor(country, links) {
  const out = [];
  for (const l of links || []) {
    const s = l.source?.id || l.source;
    const t = l.target?.id || l.target;
    if (s !== country && t !== country) continue;
    out.push({
      country: s === country ? t : s,
      sentiment: l.sentiment_score ?? l.sentiment ?? 0,
    });
  }
  return out;
}

function Bar({ sentiment }) {
  const pct = Math.min(100, Math.abs(sentiment) * 100);
  return (
    <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3 }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 3,
          background: sentimentColor(sentiment),
        }}
      />
    </div>
  );
}

function RelRow({ rel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: "1.05rem" }}>{getFlagEmoji(rel.country)}</span>
      <span style={{ fontSize: "0.78rem", width: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {rel.country}
      </span>
      <Bar sentiment={rel.sentiment} />
      <span style={{ fontSize: "0.72rem", color: sentimentColor(rel.sentiment), width: 34, textAlign: "right" }}>
        {rel.sentiment.toFixed(2)}
      </span>
    </div>
  );
}

export default function CountryDetailPanel({ country, graphData, onClose }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!country) return;
    let active = true;
    fetchEvents(country)
      .then((d) => active && setEvents((d.events || []).slice(0, 5)))
      .catch(() => active && setEvents([]));
    return () => {
      active = false;
    };
  }, [country]);

  if (!country) return null;

  const node = (graphData?.nodes || []).find((n) => (n.id || n.country) === country);
  const coalitionNames = node?.coalitions || [];
  const coalitionsMap = graphData?.coalitions || {};

  const rels = relationsFor(country, graphData?.links);
  const partners = rels
    .filter((r) => r.sentiment > 0)
    .sort((a, b) => b.sentiment - a.sentiment)
    .slice(0, 3);
  const tensions = rels
    .filter((r) => r.sentiment < 0)
    .sort((a, b) => a.sentiment - b.sentiment)
    .slice(0, 3);

  return (
    <div style={panelStyle}>
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{getFlagEmoji(country)}</span>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{country}</h2>
        </div>
        <button onClick={onClose} style={closeBtn}>
          ✕
        </button>
      </div>

      <div style={{ padding: 18, overflowY: "auto" }}>
        {coalitionNames.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {coalitionNames.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 9999,
                  color: "#fff",
                  background: coalitionsMap[c]?.color || "#94a3b8",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <h3 style={sectionTitle}>Top Partners</h3>
        {partners.length ? partners.map((r) => <RelRow key={r.country} rel={r} />) : (
          <p style={emptyText}>No positive relationships yet.</p>
        )}

        <h3 style={{ ...sectionTitle, marginTop: 16 }}>Top Tensions</h3>
        {tensions.length ? tensions.map((r) => <RelRow key={r.country} rel={r} />) : (
          <p style={emptyText}>No tensions recorded.</p>
        )}

        <h3 style={{ ...sectionTitle, marginTop: 16 }}>Recent Events</h3>
        {events.length ? (
          events.map((ev) => {
            const badge = eventBadge(ev.event_type);
            const other = ev.country_a === country ? ev.country_b : ev.country_a;
            return (
              <div
                key={ev.id}
                style={{
                  background: "#f8fafc",
                  borderRadius: 6,
                  padding: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.text,
                    }}
                  >
                    {badge.label}
                  </span>
                  <span style={{ fontSize: "0.74rem", color: "#475569" }}>
                    {getFlagEmoji(other)} {other}
                  </span>
                </div>
                <p style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.4 }}>
                  {ev.summary}
                </p>
              </div>
            );
          })
        ) : (
          <p style={emptyText}>No recent events.</p>
        )}
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

const emptyText = { fontSize: "0.75rem", color: "#94a3b8" };

const closeBtn = {
  background: "none",
  border: "none",
  fontSize: "1.1rem",
  cursor: "pointer",
  color: "#94a3b8",
  lineHeight: 1,
};
