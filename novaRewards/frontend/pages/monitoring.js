import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import ErrorBoundary from "../components/ErrorBoundary";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(decimals);
}

function relativeTime(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function severityColor(severity) {
  if (severity === "error") return "#dc2626";
  if (severity === "warn") return "#d97706";
  return "#059669";
}

function alertStateColor(state) {
  if (state === "firing") return "#dc2626";
  if (state === "resolved") return "#059669";
  return "#64748b";
}

function alertStateBadgeClass(state) {
  if (state === "firing") return "badge-red";
  if (state === "resolved") return "badge-green";
  return "badge-gray";
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Single stat card used in the metrics grid.
 */
function StatCard({ label, value, unit, color, subLabel }) {
  return (
    <div
      className="card"
      style={{ textAlign: "center", marginBottom: 0 }}
    >
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
        {label}
      </p>
      <p
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: color ?? "var(--accent)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {(unit || subLabel) && (
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
          {unit ?? subLabel}
        </p>
      )}
    </div>
  );
}

/**
 * Response-time row in the routes table.
 */
function RouteRow({ route, stats }) {
  const p95Color = stats.p95 > 1000 ? "#dc2626" : stats.p95 > 500 ? "#d97706" : "#059669";
  return (
    <tr>
      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{route}</td>
      <td style={{ textAlign: "right" }}>{stats.count}</td>
      <td style={{ textAlign: "right" }}>{fmt(stats.avg)} ms</td>
      <td style={{ textAlign: "right" }}>{fmt(stats.p50)} ms</td>
      <td style={{ textAlign: "right", color: p95Color, fontWeight: 600 }}>
        {fmt(stats.p95)} ms
      </td>
      <td style={{ textAlign: "right" }}>{fmt(stats.p99)} ms</td>
    </tr>
  );
}

/**
 * Single event row in the live event feed.
 */
function EventRow({ event }) {
  const color = severityColor(event.severity);
  return (
    <tr>
      <td style={{ color, fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
        {event.type}
      </td>
      <td
        style={{
          fontFamily: "monospace",
          fontSize: "0.75rem",
          color: "var(--muted)",
          whiteSpace: "nowrap",
        }}
      >
        {relativeTime(event.timestamp)}
      </td>
      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        {event.payload
          ? Object.entries(event.payload)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${String(v).slice(0, 32)}`)
              .join(" · ")
          : ""}
      </td>
    </tr>
  );
}

/**
 * Alert card — one per rule.
 */
function AlertCard({ alert }) {
  const isFiring = alert.state === "firing";
  const borderColor = alertStateColor(alert.state);

  return (
    <div
      className="card"
      style={{
        marginBottom: "0.75rem",
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.5rem",
        }}
      >
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>{alert.name}</p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
            {alert.message}
          </p>
          {isFiring && alert.firedAt && (
            <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.2rem" }}>
              Firing since {relativeTime(alert.firedAt)}
            </p>
          )}
          {alert.state === "resolved" && alert.resolvedAt && (
            <p style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.2rem" }}>
              Resolved {relativeTime(alert.resolvedAt)}
            </p>
          )}
        </div>
        <span
          className={`badge ${alertStateBadgeClass(alert.state)}`}
          style={{ flexShrink: 0 }}
        >
          {alert.state.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function MonitoringContent() {
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [firingCount, setFiringCount] = useState(0);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [eventFilter, setEventFilter] = useState("all");

  // Event type options derived from the data
  const EVENT_TYPES = [
    "all",
    "reward.distributed",
    "reward.redeemed",
    "transfer.completed",
    "trustline.created",
    "campaign.created",
    "merchant.registered",
    "error.blockchain",
    "error.application",
    "alert.fired",
    "alert.resolved",
  ];

  const fetchAll = useCallback(async () => {
    try {
      setError(null);

      const typeParam = eventFilter !== "all" ? `&type=${encodeURIComponent(eventFilter)}` : "";

      const [metricsRes, eventsRes, alertsRes] = await Promise.all([
        api.get("/api/monitoring/metrics"),
        api.get(`/api/monitoring/events?limit=50${typeParam}`),
        api.get("/api/monitoring/alerts?history=false"),
      ]);

      setMetrics(metricsRes.data.data);
      setEvents(eventsRes.data.data.events ?? []);
      setEventsTotal(eventsRes.data.data.total ?? 0);
      setAlerts(alertsRes.data.data.alerts ?? []);
      setFiringCount(alertsRes.data.data.firing ?? 0);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Failed to fetch monitoring data");
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  // Initial load and auto-refresh every 15 s
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 15_000);
    return () => clearInterval(id);
  }, [fetchAll, autoRefresh]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const counters = metrics?.counters ?? {};
  const responseTimes = metrics?.responseTimes ?? {};
  const uptime = metrics?.uptime ?? 0;
  const uptimeStr =
    uptime < 60
      ? `${uptime}s`
      : uptime < 3600
      ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
      : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Navigation ── */}
      <nav className="nav">
        <span className="nav-brand">⭐ NovaRewards</span>
        <div className="nav-links">
          <a href="/">Customer</a>
          <a href="/merchant">Merchant</a>
          <a href="/monitoring" style={{ color: "var(--accent)", fontWeight: 700 }}>
            Monitoring
          </a>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: 1100 }}>
        {/* ── Page header ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>Monitoring</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Uptime: {uptimeStr}
              {lastRefreshed && (
                <span> · Last refreshed {relativeTime(lastRefreshed.toISOString())}</span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--muted)", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (15s)
            </label>
            <button
              className="btn btn-secondary"
              onClick={fetchAll}
              disabled={loading}
              style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderLeft: "4px solid #dc2626", marginBottom: "1.5rem" }}>
            <p className="error">{error}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.4rem" }}>
              Make sure the backend is running and NEXT_PUBLIC_API_URL is configured.
            </p>
          </div>
        )}

        {/* ── Alerts panel ── */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ fontSize: "1.1rem" }}>
              Alerts{" "}
              {firingCount > 0 && (
                <span
                  className="badge"
                  style={{ background: "#dc2626", color: "#fff", marginLeft: "0.5rem" }}
                >
                  {firingCount} FIRING
                </span>
              )}
              {firingCount === 0 && alerts.length > 0 && (
                <span className="badge badge-green" style={{ marginLeft: "0.5rem" }}>
                  ALL CLEAR
                </span>
              )}
            </h2>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No alert rules loaded yet.</p>
          ) : (
            alerts.map((a) => <AlertCard key={a.id} alert={a} />)
          )}
        </div>

        {/* ── Metrics overview grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatCard
            label="Total Requests"
            value={counters["http.requests.total"] ?? 0}
            unit="requests"
          />
          <StatCard
            label="Error Rate"
            value={fmt(metrics?.errorRate ?? 0, 1)}
            unit="%"
            color={
              (metrics?.errorRate ?? 0) > 10
                ? "#dc2626"
                : (metrics?.errorRate ?? 0) > 5
                ? "#d97706"
                : "#059669"
            }
          />
          <StatCard
            label="5xx Errors"
            value={counters["http.requests.errors.5xx"] ?? 0}
            color={(counters["http.requests.errors.5xx"] ?? 0) > 0 ? "#dc2626" : "#059669"}
          />
          <StatCard
            label="4xx Errors"
            value={counters["http.requests.errors.4xx"] ?? 0}
            color={(counters["http.requests.errors.4xx"] ?? 0) > 10 ? "#d97706" : "#059669"}
          />
          <StatCard
            label="Distributions"
            value={counters["events.reward.distributed"] ?? 0}
            unit="rewards sent"
            color="#7c3aed"
          />
          <StatCard
            label="Redemptions"
            value={counters["events.reward.redeemed"] ?? 0}
            unit="redeemed"
            color="#059669"
          />
          <StatCard
            label="Blockchain Errors"
            value={counters["events.error.blockchain"] ?? 0}
            color={(counters["events.error.blockchain"] ?? 0) > 0 ? "#dc2626" : "#059669"}
          />
          <StatCard
            label="Merchants Registered"
            value={counters["events.merchant.registered"] ?? 0}
            color="#0284c7"
          />
        </div>

        {/* ── Response time table ── */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Response Times by Route</h2>
          {Object.keys(responseTimes).length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No route data yet — response times appear after the first requests.
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th style={{ textAlign: "right" }}>Requests</th>
                    <th style={{ textAlign: "right" }}>Avg</th>
                    <th style={{ textAlign: "right" }}>p50</th>
                    <th style={{ textAlign: "right" }}>p95</th>
                    <th style={{ textAlign: "right" }}>p99</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(responseTimes)
                    .sort((a, b) => b[1].p95 - a[1].p95)
                    .map(([route, stats]) => (
                      <RouteRow key={route} route={route} stats={stats} />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Event feed ── */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.1rem" }}>
              Event Feed
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                ({eventsTotal} total)
              </span>
            </h2>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              style={{
                padding: "0.4rem 0.7rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
              aria-label="Filter events by type"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All types" : t}
                </option>
              ))}
            </select>
          </div>

          {events.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              {eventFilter !== "all"
                ? `No "${eventFilter}" events recorded yet.`
                : "No events recorded yet. Events appear as requests are processed."}
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>When</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <EventRow key={ev.id} event={ev} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Counters raw view ── */}
        <details className="card" style={{ cursor: "pointer" }}>
          <summary style={{ fontWeight: 600, fontSize: "0.95rem", userSelect: "none" }}>
            Raw Counters &amp; Gauges
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              All metric keys and their current values.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th style={{ textAlign: "right" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries({ ...counters, ...(metrics?.gauges ?? {}) })
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([key, val]) => (
                      <tr key={key}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{key}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {val}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}

export default function MonitoringPage() {
  return (
    <ErrorBoundary>
      <MonitoringContent />
    </ErrorBoundary>
  );
}
