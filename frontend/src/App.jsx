
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Droplets,
  Gauge,
  LayoutDashboard,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Thermometer,
  Wind,
  Wrench,
  Zap,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./services/api";
import "./App.css";

const REFRESH_MS = 5000;

function getCollection(value, keys = []) {
  if (Array.isArray(value)) return value;

  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  return [];
}

function getLatest(value) {
  if (Array.isArray(value)) return value[0] ?? null;

  return (
    value?.reading ??
    value?.latest ??
    value?.telemetry ??
    value?.item ??
    value ??
    null
  );
}

function formatTime(value) {
  if (!value) return "—";

  const date =
    typeof value === "number"
      ? new Date(value)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString(undefined, {
        maximumFractionDigits: digits,
      })
    : "—";
}

function getStatus(reading) {
  const status = String(
    reading?.status ??
      reading?.health_status ??
      "UNKNOWN"
  ).toUpperCase();

  if (["NORMAL", "WARNING", "CRITICAL"].includes(status)) {
    return status;
  }

  return "UNKNOWN";
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  description,
  index,
}) {
  return (
    <article
      className="metric-card"
      style={{ "--card-index": index }}
    >
      <div className="metric-top">
        <span className="metric-label">{label}</span>

        <span
          className="metric-icon"
          style={{ "--metric-color": color }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </span>
      </div>

      <div className="metric-reading">
        <span className="metric-number">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>

      <div className="metric-bottom">
        <span className="metric-description">{description}</span>
        <span
          className="metric-accent"
          style={{ background: color }}
        />
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {detail && <p className="section-detail">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, detail, icon: Icon = Activity }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export default function App() {
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessages, setErrorMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("ALL");

  const refreshDashboard = useCallback(async () => {
    const results = await Promise.allSettled([
      api.health(),
      api.latest(),
      api.history(),
      api.alerts(),
      api.stats(),
    ]);

    const [healthResult, latestResult, historyResult, alertResult] =
      results;

    const errors = [];

    setApiOnline(healthResult.status === "fulfilled");

    if (healthResult.status === "rejected") {
      errors.push("Backend health endpoint is unavailable.");
    }

    if (latestResult.status === "fulfilled") {
      setReading(getLatest(latestResult.value));
    } else {
      errors.push("Could not retrieve the latest telemetry.");
    }

    if (historyResult.status === "fulfilled") {
      setHistory(
        getCollection(historyResult.value, [
          "items",
          "readings",
          "telemetry",
          "data",
          "records",
        ])
      );
    } else {
      errors.push("Could not retrieve sensor history.");
    }

    if (alertResult.status === "fulfilled") {
      setAlerts(
        getCollection(alertResult.value, [
          "items",
          "alerts",
          "data",
          "records",
        ])
      );
    } else {
      errors.push("Could not retrieve alerts.");
    }

    setErrorMessages(errors);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshDashboard();

    if (paused) return undefined;

    const timer = window.setInterval(
      refreshDashboard,
      REFRESH_MS
    );

    return () => window.clearInterval(timer);
  }, [refreshDashboard, paused]);

  const status = getStatus(reading);

  const chartData = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const timeA = new Date(
        a.timestamp ?? Number(a.timestamp_ms ?? 0)
      ).getTime();

      const timeB = new Date(
        b.timestamp ?? Number(b.timestamp_ms ?? 0)
      ).getTime();

      return timeA - timeB;
    });

    const valid = sorted
      .map((item, index) => {
        const temperature = Number(item.temperature_c);

        let timestamp = item.timestamp;

        if (!timestamp && item.timestamp_ms != null) {
          timestamp = Number(item.timestamp_ms);
        }

        const date = timestamp ? new Date(timestamp) : null;

        return {
          index,
          time:
            date && !Number.isNaN(date.getTime())
              ? date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : `Reading ${index + 1}`,
          temperature: Number.isFinite(temperature)
            ? temperature
            : null,
        };
      })
      .filter((item) => item.temperature !== null);

    if (range === "12") return valid.slice(-12);
    if (range === "6") return valid.slice(-6);

    return valid;
  }, [history, range]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const text = [
        alert.machine_id,
        alert.message,
        alert.description,
        alert.status,
        alert.severity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !query || text.includes(query);
    });
  }, [alerts, search]);

  const criticalCount = alerts.filter((alert) => {
    const severity = String(
      alert.severity ?? alert.status ?? ""
    ).toUpperCase();

    return severity === "CRITICAL";
  }).length;

  const machineId = reading?.machine_id ?? "MOTOR_01";

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-mark">
            <Activity size={25} strokeWidth={2.4} />
          </span>

          <span className="brand-copy">
            <strong>
              MACHINE<span>HEALTH</span>
            </strong>
            <small>INDUSTRIAL INTELLIGENCE</small>
          </span>
        </a>

        <div className="sidebar-caption">WORKSPACE</div>

        <nav className="side-nav">
          <a className="nav-link active" href="#overview">
            <LayoutDashboard size={18} />
            <span>Overview</span>
            <ChevronRight className="nav-chevron" size={16} />
          </a>

          <a className="nav-link" href="#telemetry">
            <Activity size={18} />
            <span>Sensor telemetry</span>
          </a>

          <a className="nav-link" href="#alerts">
            <Bell size={18} />
            <span>Alert center</span>
            {alerts.length > 0 && (
              <span className="nav-count">{alerts.length}</span>
            )}
          </a>

          <a className="nav-link" href="#system">
            <Server size={18} />
            <span>System health</span>
          </a>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-caption">PLATFORM</div>

        <div className="platform-item">
          <span className="platform-icon">
            <Radio size={17} />
          </span>
          <span>
            <strong>MQTT ingestion</strong>
            <small>Sensor data pipeline</small>
          </span>
          <span className="mini-dot" />
        </div>

        <div className="platform-item">
          <span className="platform-icon">
            <Cpu size={17} />
          </span>
          <span>
            <strong>Edge processing</strong>
            <small>FastAPI / SQLite</small>
          </span>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-orb">
            <Gauge size={22} />
          </div>
          <div className="profile-copy">
            <strong>MachineHealth</strong>
            <small>Predictive maintenance</small>
          </div>
          <span className="version-tag">V1.0</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>WORKSPACE</span>
            <ChevronRight size={14} />
            <strong>OVERVIEW</strong>
          </div>

          <div className="topbar-right">
            <div
              className={`connection-chip ${
                apiOnline ? "connected" : "disconnected"
              }`}
            >
              <span className="connection-dot" />
              {apiOnline ? "BACKEND CONNECTED" : "BACKEND OFFLINE"}
            </div>

            <button
              className="icon-button"
              onClick={refreshDashboard}
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <section className="hero" id="overview">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="eyebrow-line" />
              INDUSTRIAL MONITORING SYSTEM
            </div>

            <h1>
              Machine
              <br />
              <span>intelligence.</span>
            </h1>

            <p className="hero-description">
              A real-time view into your equipment health,
              sensor telemetry, and operational alerts.
            </p>

            <div className="hero-meta">
              <span className="machine-tag">
                <Cpu size={15} />
                {machineId}
              </span>

              <span className="meta-divider" />

              <span className="last-seen">
                <Clock3 size={14} />
                Updated {formatTime(lastUpdated)}
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />

            <div className="orbit-core">
              <div className="core-inner">
                <Activity size={42} strokeWidth={1.5} />
              </div>
            </div>

            <span className="orbit-point point-one" />
            <span className="orbit-point point-two" />
            <span className="orbit-point point-three" />

            <div className="floating-label label-top">
              <span className="mini-dot" />
              TELEMETRY ACTIVE
            </div>

            <div className="floating-label label-bottom">
              <ShieldCheck size={15} />
              MONITORING ENABLED
            </div>
          </div>

          <div className="hero-index">
            <span>01</span>
            <span className="index-rule" />
            <span>04</span>
          </div>
        </section>

        <section className="status-strip">
          <div className="status-main">
            <span className={`status-symbol ${status.toLowerCase()}`}>
              {status === "CRITICAL" ? (
                <XCircle size={20} />
              ) : status === "WARNING" ? (
                <AlertTriangle size={20} />
              ) : status === "NORMAL" ? (
                <CheckCircle2 size={20} />
              ) : (
                <Activity size={20} />
              )}
            </span>

            <div>
              <span className="status-caption">
                MACHINE HEALTH STATUS
              </span>
              <strong className={`status-value ${status.toLowerCase()}`}>
                {status === "UNKNOWN" ? "AWAITING DATA" : status}
              </strong>
            </div>
          </div>

          <div className="status-separator" />

          <div className="status-detail">
            <span>Machine identifier</span>
            <strong>{machineId}</strong>
          </div>

          <div className="status-detail">
            <span>Telemetry records</span>
            <strong>{history.length.toLocaleString()}</strong>
          </div>

          <div className="status-detail">
            <span>Recorded critical alerts</span>
            <strong className={criticalCount > 0 ? "text-critical" : ""}>
              {criticalCount}
            </strong>
          </div>
        </section>

        {errorMessages.length > 0 && (
          <div className="error-panel" role="status">
            <AlertTriangle size={19} />
            <div>
              <strong>Some data could not be loaded</strong>
              <p>{errorMessages.join(" ")}</p>
              <p>
                Check that FastAPI is running and that CORS is
                configured for the frontend origin.
              </p>
            </div>
          </div>
        )}

        <section className="content-section" id="telemetry">
          <SectionHeading
            eyebrow="01 / LIVE INSTRUMENTATION"
            title="Sensor telemetry"
            detail="Latest values received and stored by the backend."
            action={
              <div className="refresh-controls">
                <span className="live-indicator">
                  <span className="mini-dot" />
                  {paused ? "UPDATES PAUSED" : "AUTO-REFRESH"}
                </span>

                <button
                  className="secondary-button"
                  onClick={() => setPaused((value) => !value)}
                >
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                  {paused ? "Resume" : "Pause"}
                </button>
              </div>
            }
          />

          <div className="metrics-grid">
            <MetricCard
              index={0}
              label="TEMPERATURE"
              value={formatNumber(reading?.temperature_c)}
              unit="°C"
              icon={Thermometer}
              color="#B8F36B"
              description="Motor thermal reading"
            />

            <MetricCard
              index={1}
              label="HUMIDITY"
              value={formatNumber(reading?.humidity_percent)}
              unit="%"
              icon={Droplets}
              color="#68D8F5"
              description="Ambient moisture"
            />

            <MetricCard
              index={2}
              label="VIBRATION EVENT"
              value={
                reading?.vibration_event == null
                  ? "—"
                  : Number(reading.vibration_event) === 1
                    ? "DETECTED"
                    : "NONE"
              }
              unit=""
              icon={Activity}
              color="#D3A7FF"
              description="Binary event indicator"
            />

            <MetricCard
              index={3}
              label="GAS SENSOR"
              value={formatNumber(reading?.gas_raw, 0)}
              unit="RAW"
              icon={Wind}
              color="#FFBE72"
              description="Uncalibrated sensor output"
            />
          </div>
        </section>

        <section className="analytics-grid">
          <article className="surface-panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">PERFORMANCE ANALYTICS</span>
                <h2>Temperature <span>trajectory.</span></h2>
                <p>Recorded machine temperature over time.</p>
              </div>

              <div className="chart-mark">
                <Activity size={20} />
              </div>
            </div>

            <div className="chart-toolbar">
              <span className="chart-legend">
                <span className="legend-dot" />
                TEMPERATURE °C
              </span>

              <div className="range-switch" aria-label="Chart range">
                {[
                  { label: "6", value: "6" },
                  { label: "12", value: "12" },
                  { label: "ALL", value: "ALL" },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={range === option.value ? "selected" : ""}
                    onClick={() => setRange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="temperatureFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#B8F36B"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor="#B8F36B"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#233143"
                      strokeDasharray="3 6"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="time"
                      stroke="#718198"
                      tick={{ fill: "#8796A9", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={25}
                    />

                    <YAxis
                      stroke="#718198"
                      tick={{ fill: "#8796A9", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      domain={["auto", "auto"]}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#101923",
                        border: "1px solid #35465A",
                        borderRadius: "10px",
                        color: "#F1F5F9",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "#B8F36B" }}
                      formatter={(value) => [`${value} °C`, "Temperature"]}
                    />

                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="#B8F36B"
                      strokeWidth={2.5}
                      fill="url(#temperatureFill)"
                      connectNulls
                      isAnimationActive
                      animationDuration={650}
                      activeDot={{
                        r: 5,
                        stroke: "#B8F36B",
                        strokeWidth: 2,
                        fill: "#101923",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title={
                  loading
                    ? "Loading telemetry"
                    : "Waiting for history data"
                }
                detail="The chart will populate when the history endpoint returns valid temperature readings."
              />
            )}

            <div className="chart-footnote">
              <span>
                <Clock3 size={13} />
                {chartData.length} recorded data points
              </span>
              <span>Source: FastAPI telemetry API</span>
            </div>
          </article>

          <article className="surface-panel system-panel" id="system">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">INFRASTRUCTURE</span>
                <h2>System <span>pulse.</span></h2>
                <p>Application connectivity checks.</p>
              </div>
              <span className="system-icon">
                <Server size={20} />
              </span>
            </div>

            <div className="system-health-banner">
              <div className={`system-health-icon ${apiOnline ? "online" : ""}`}>
                {apiOnline ? (
                  <CheckCircle2 size={21} />
                ) : (
                  <AlertTriangle size={21} />
                )}
              </div>
              <div>
                <strong>
                  {apiOnline ? "API reachable" : "API unavailable"}
                </strong>
                <p>
                  {apiOnline
                    ? "Health endpoint responded successfully."
                    : "Unable to confirm backend connectivity."}
                </p>
              </div>
            </div>

            <div className="system-list">
              <div className="system-row">
                <span className="system-label">
                  <Server size={15} />
                  FastAPI backend
                </span>
                <span className={`system-value ${apiOnline ? "online" : "offline"}`}>
                  <span className="mini-dot" />
                  {apiOnline ? "REACHABLE" : "OFFLINE"}
                </span>
              </div>

              <div className="system-row">
                <span className="system-label">
                  <Radio size={15} />
                  MQTT ingestion
                </span>
                <span className="system-value">CONFIGURED</span>
              </div>

              <div className="system-row">
                <span className="system-label">
                  <Zap size={15} />
                  Latest reading
                </span>
                <span className="system-value">
                  {reading ? "AVAILABLE" : "NO DATA"}
                </span>
              </div>

              <div className="system-row">
                <span className="system-label">
                  <Clock3 size={15} />
                  Last dashboard refresh
                </span>
                <span className="system-value">
                  {formatTime(lastUpdated)}
                </span>
              </div>
            </div>

            <div className="system-note">
              <ShieldCheck size={17} />
              <p>
                MQTT status is based on configuration, not an independent
                broker health check. Verify the broker separately.
              </p>
            </div>
          </article>
        </section>

        <section className="content-section alerts-section" id="alerts">
          <SectionHeading
            eyebrow="02 / EVENT MANAGEMENT"
            title="Alert center"
            detail="Review events recorded by the backend assessment service."
            action={
              <span className="alert-total">
                {alerts.length} RECORD{alerts.length === 1 ? "" : "S"}
              </span>
            }
          />

          <article className="surface-panel alert-panel">
            <div className="alert-toolbar">
              <div className="alert-toolbar-title">
                <Bell size={17} />
                <strong>Recent events</strong>
              </div>

              <label className="search-box">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search alerts..."
                  aria-label="Search alerts"
                />
              </label>
            </div>

            {filteredAlerts.length > 0 ? (
              <div className="alert-list">
                {filteredAlerts.slice(0, 10).map((alert, index) => {
                  const severity = String(
                    alert.severity ?? alert.status ?? "WARNING"
                  ).toUpperCase();

                  const critical = severity === "CRITICAL";
                  const acknowledged =
                    alert.acknowledged === true ||
                    String(alert.status ?? "").toUpperCase() ===
                      "ACKNOWLEDGED";

                  return (
                    <div
                      className="alert-item"
                      key={alert.id ?? `${alert.timestamp}-${index}`}
                    >
                      <span
                        className={`alert-symbol ${
                          critical ? "critical" : "warning"
                        }`}
                      >
                        {critical ? (
                          <XCircle size={18} />
                        ) : (
                          <AlertTriangle size={18} />
                        )}
                      </span>

                      <div className="alert-main">
                        <strong>
                          {alert.message ??
                            alert.description ??
                            "Recorded machine alert"}
                        </strong>
                        <span>
                          {alert.machine_id ?? machineId}
                          {" · "}
                          {formatTime(
                            alert.timestamp ?? alert.created_at
                          )}
                        </span>
                      </div>

                      <span
                        className={`alert-severity ${
                          critical ? "critical" : "warning"
                        }`}
                      >
                        {severity}
                      </span>

                      <span
                        className={`ack-state ${
                          acknowledged ? "acknowledged" : ""
                        }`}
                      >
                        {acknowledged ? "ACKNOWLEDGED" : "RECORDED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={
                  alerts.length === 0
                    ? "No alert records returned"
                    : "No matching alerts"
                }
                detail={
                  alerts.length === 0
                    ? "When the backend records alerts, they will appear here."
                    : "Try a different search term."
                }
              />
            )}
          </article>
        </section>

        <footer className="dashboard-footer">
          <div className="footer-brand">
            <Activity size={15} />
            MACHINEHEALTH
            <span>INDUSTRIAL MONITORING</span>
          </div>

          <div className="footer-right">
            <span>
              <Wrench size={13} />
              THRESHOLD-BASED ASSESSMENT
            </span>
            <span>V1.0.0</span>
            <ArrowUpRight size={15} />
          </div>
        </footer>
      </main>
    </div>
  );
}