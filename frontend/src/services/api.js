
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => request("/api/v1/health"),
  latest: () => request("/api/v1/telemetry/latest"),
  history: () => request("/api/v1/telemetry"),
  alerts: () => request("/api/v1/alerts"),
  stats: () => request("/api/v1/stats"),
};