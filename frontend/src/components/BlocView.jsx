import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getFlagEmoji } from "../utils";

const dominantType = (breakdown = {}) => {
  let best = "OTHER";
  let max = -1;
  for (const [k, v] of Object.entries(breakdown)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
};

export default function BlocView({ graphData, onCountryClick, onCoalitionClick, sidebarOpen }) {
  const wrapperRef = useRef(null);
  const nodeRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  const coalitions = graphData?.coalitions || {};
  const links = graphData?.links || [];

  // Assign each country to its PRIMARY coalition (first in insertion order) and
  // index every coalition it belongs to (for the "other coalition" dots).
  const { primaryOf, membersIndex } = useMemo(() => {
    const primaryOf = {};
    const membersIndex = {};
    for (const [cname, info] of Object.entries(coalitions)) {
      for (const m of info.members) {
        if (!(m in primaryOf)) primaryOf[m] = cname;
        (membersIndex[m] ||= []).push(cname);
      }
    }
    return { primaryOf, membersIndex };
  }, [coalitions]);

  const recompute = useCallback(() => {
    // Each country node's exact on-screen center, in viewport coordinates —
    // the SVG overlay is position:fixed over the viewport, so getBoundingClientRect
    // values can be used directly.
    const pos = {};
    for (const [name, el] of Object.entries(nodeRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      pos[name] = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
    }

    const next = [];
    for (const l of links) {
      const s = l.sentiment_score ?? l.sentiment ?? 0;
      if (Math.abs(s) <= 0.3) continue;
      const aName = l.source?.id || l.source;
      const bName = l.target?.id || l.target;
      const pa = pos[aName];
      const pb = pos[bName];
      if (!pa || !pb) continue;
      next.push({
        key: `${aName}|${bName}`,
        a: aName,
        b: bName,
        x1: pa.x,
        y1: pa.y,
        x2: pb.x,
        y2: pb.y,
        color: s > 0 ? "#16a34a" : "#dc2626",
        opacity: Math.max(0.15, Math.min(1, Math.abs(s))),
        sentiment: s,
        type: dominantType(l.event_breakdown),
      });
    }
    setLines(next);
  }, [links]);

  // Recompute after layout and on data change.
  useLayoutEffect(() => {
    recompute();
    const id = requestAnimationFrame(recompute); // emoji/font reflow
    const t = setTimeout(recompute, 250);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [recompute, graphData]);

  // The sidebar's 0.3s push transition shifts content right over time, so track
  // every frame for the duration of the animation to keep the lines glued to the
  // country nodes as they move.
  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      recompute();
      if (now - start < 400) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sidebarOpen, recompute]);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    // ResizeObserver on the main container catches the content shift while the
    // sidebar opens/closes as well as window/layout changes.
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    window.addEventListener("resize", recompute);
    wrap.addEventListener("scroll", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      wrap.removeEventListener("scroll", recompute);
    };
  }, [recompute]);

  const setNodeRef = (name) => (el) => {
    if (el) nodeRefs.current[name] = el;
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", flex: 1, overflow: "auto", padding: 20 }}
    >
      {/* SVG relationship overlay — fixed over the whole viewport, drawing in
          viewport coordinates straight from each country node's center. */}
      <svg
        width="100vw"
        height="100vh"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {lines.map((ln) => {
          const dx = ln.x2 - ln.x1;
          const dy = ln.y2 - ln.y1;
          // Two control points offset perpendicular to the line for a smooth arc.
          const c1x = ln.x1 + dx * 0.25 + dy * 0.12;
          const c1y = ln.y1 + dy * 0.25 - dx * 0.12;
          const c2x = ln.x1 + dx * 0.75 + dy * 0.12;
          const c2y = ln.y1 + dy * 0.75 - dx * 0.12;
          const d = `M ${ln.x1} ${ln.y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${ln.x2} ${ln.y2}`;
          const mx = (ln.x1 + ln.x2) / 2 + dy * 0.12;
          const my = (ln.y1 + ln.y2) / 2 - dx * 0.12;
          return (
            <g key={ln.key}>
              {/* invisible wide hit area */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseEnter={() =>
                  setTooltip({ x: mx, y: my, text: `${ln.a} ↔ ${ln.b}: ${ln.type} | sentiment: ${ln.sentiment.toFixed(2)}` })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              <path d={d} fill="none" stroke={ln.color} strokeWidth={1.5} strokeOpacity={ln.opacity} />
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -130%)",
            background: "#0f172a",
            color: "#fff",
            fontSize: "0.7rem",
            padding: "4px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Coalition grid */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {Object.entries(coalitions).map(([cname, info]) => {
          const members = info.members.filter((m) => primaryOf[m] === cname);
          return (
            <div
              key={cname}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderLeft: `4px solid ${info.color}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>{cname}</h3>
                <button
                  onClick={() => onCoalitionClick({ name: cname, ...info })}
                  title="Coalition info"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `1px solid ${info.color}`,
                    color: info.color,
                    background: "#fff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontStyle: "italic",
                    lineHeight: 1,
                  }}
                >
                  i
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {members.map((m) => {
                  const others = (membersIndex[m] || []).filter((c) => c !== cname);
                  return (
                    <div
                      key={m}
                      ref={setNodeRef(m)}
                      onClick={() => onCountryClick(m)}
                      style={{
                        width: 64,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "1.5rem", lineHeight: 1.1 }}>{getFlagEmoji(m)}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          maxWidth: 64,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "center",
                        }}
                        title={m}
                      >
                        {m}
                      </span>
                      {others.length > 0 && (
                        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                          {others.map((c) => (
                            <span
                              key={c}
                              title={c}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: coalitions[c]?.color || "#94a3b8",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
