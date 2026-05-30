import { useEffect, useState } from "react";
import { fetchEvents, fetchGraph } from "./api";
import Header from "./components/Header";
import ViewToggle from "./components/ViewToggle";
import BlocView from "./components/BlocView";
import NetworkView from "./components/NetworkView";
import CoalitionPanel from "./components/CoalitionPanel";
import CountryDetailPanel from "./components/CountryDetailPanel";
import EventFeed from "./components/EventFeed";
import SentimentLegend from "./components/SentimentLegend";

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [], coalitions: {} });
  const [events, setEvents] = useState([]);
  const [view, setView] = useState("bloc");
  const [selectedCoalition, setSelectedCoalition] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchGraph(), fetchEvents("")])
      .then(([g, e]) => {
        if (!active) return;
        setGraphData(g);
        setEvents(e.events || []);
      })
      .catch((err) => console.error("load failed", err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const lastUpdated = events[0]?.created_at
    ? new Date(events[0].created_at).toLocaleDateString()
    : new Date().toLocaleDateString();

  const handleCountry = (name) => {
    setSelectedCountry(name);
    setSelectedCoalition(null);
  };
  const handleCoalition = (coalition) => {
    setSelectedCoalition(coalition);
    setSelectedCountry(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header lastUpdated={lastUpdated} />
      <ViewToggle view={view} onChange={setView} />

      {/* Side-by-side flex layout: the Recent Events sidebar pushes the main
          content right instead of overlaying it. */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <EventFeed
          events={events}
          open={sidebarOpen}
          onToggle={setSidebarOpen}
        />

        <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>
          {loading ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div className="spinner" />
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Loading relations…</p>
            </div>
          ) : view === "bloc" ? (
            <BlocView
              graphData={graphData}
              onCountryClick={handleCountry}
              onCoalitionClick={handleCoalition}
              sidebarOpen={sidebarOpen}
            />
          ) : (
            <NetworkView graphData={graphData} onNodeClick={handleCountry} />
          )}
        </div>
      </div>

      <SentimentLegend />

      {selectedCountry ? (
        <CountryDetailPanel
          country={selectedCountry}
          graphData={graphData}
          onClose={() => setSelectedCountry(null)}
        />
      ) : selectedCoalition ? (
        <CoalitionPanel
          coalition={selectedCoalition}
          graphData={graphData}
          onClose={() => setSelectedCoalition(null)}
        />
      ) : null}
    </div>
  );
}
