// Base URL of the backend API. Defaults to the FastAPI service on :8000, but
// can be pointed at the ASP.NET Core read API (see dotnet-api/) by setting
// VITE_API_BASE, e.g. VITE_API_BASE=http://localhost:5080.
const BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export const fetchGraph = () => fetch(`${BASE}/api/graph`).then((r) => r.json());

export const fetchCountryHistory = (name) =>
  fetch(`${BASE}/api/countries/${encodeURIComponent(name)}/history`).then((r) =>
    r.json()
  );

export const fetchEvents = (country = "") =>
  fetch(`${BASE}/api/events?country=${encodeURIComponent(country)}&limit=20`).then(
    (r) => r.json()
  );

export const triggerRefresh = () =>
  fetch(`${BASE}/api/refresh`, { method: "POST" }).then((r) => r.json());
