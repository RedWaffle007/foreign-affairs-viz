import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getFlagEmoji, sentimentColor } from "../utils";

export default function NetworkView({ graphData, onNodeClick }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clone — react-force-graph mutates the data it's handed.
  const data = useMemo(
    () => ({
      nodes: (graphData?.nodes || []).map((n) => ({ ...n })),
      links: (graphData?.links || []).map((l) => ({ ...l })),
    }),
    [graphData]
  );

  const maxEvents = useMemo(
    () => Math.max(1, ...data.links.map((l) => l.event_count || 0)),
    [data]
  );

  // Tune the force simulation per spec: charge=-200, link distance=120.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge").strength(-200);
    fg.d3Force("link").distance(120);
  }, [data]);

  const linkColor = (l) => {
    const s = l.sentiment_score ?? l.sentiment ?? 0;
    if (s > 0.3) return "#16a34a";
    if (s < -0.3) return "#dc2626";
    return "#e2e8f0";
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#ffffff" }}>
      {data.nodes.length === 0 ? (
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
          No data yet — fetching news…
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          width={dims.width}
          height={dims.height}
          graphData={data}
          backgroundColor="#ffffff"
          linkColor={linkColor}
          linkWidth={(l) => 0.5 + ((l.event_count || 0) / maxEvents) * 4}
          onNodeClick={(node) => onNodeClick?.(node.id || node.country)}
          nodeLabel={(n) => n.country}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            ctx.font = `${20 / globalScale}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(getFlagEmoji(node.country), node.x, node.y);

            ctx.font = `${8 / globalScale}px sans-serif`;
            ctx.fillStyle = "#374151";
            ctx.fillText(node.country, node.x, node.y + 14 / globalScale);
          }}
        />
      )}
    </div>
  );
}
