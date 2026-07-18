/**
 * In-memory metrics collector.
 * Provides counters, gauges, and response-time histograms.
 * All data is lost on restart — suitable for single-instance deployments and development.
 * For production scale-out, swap the store for Redis.
 */

const MAX_HISTOGRAM_SAMPLES = 1000; // ring-buffer size per route bucket

/** @type {Map<string, number>} name → integer */
const counters = new Map();

/** @type {Map<string, number>} name → float */
const gauges = new Map();

/**
 * Histogram bucket: stores the last N response-time samples per label
 * so we can compute p50/p95/p99 on demand without keeping the full history.
 * @type {Map<string, number[]>}
 */
const histograms = new Map();

// ──────────────────────────────────────────────
// Counters
// ──────────────────────────────────────────────

/**
 * Increment a counter by `delta` (default 1).
 * @param {string} name
 * @param {number} [delta=1]
 */
function increment(name, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

/**
 * Read a counter value (0 if never set).
 * @param {string} name
 * @returns {number}
 */
function getCounter(name) {
  return counters.get(name) ?? 0;
}

// ──────────────────────────────────────────────
// Gauges
// ──────────────────────────────────────────────

/**
 * Set a gauge to an absolute value.
 * @param {string} name
 * @param {number} value
 */
function setGauge(name, value) {
  gauges.set(name, value);
}

/**
 * Read a gauge value (0 if never set).
 * @param {string} name
 * @returns {number}
 */
function getGauge(name) {
  return gauges.get(name) ?? 0;
}

// ──────────────────────────────────────────────
// Histograms (response times)
// ──────────────────────────────────────────────

/**
 * Record a response time sample for a given label (e.g. "GET /api/rewards/distribute").
 * @param {string} label
 * @param {number} ms  - duration in milliseconds
 */
function recordResponseTime(label, ms) {
  if (!histograms.has(label)) {
    histograms.set(label, []);
  }
  const bucket = histograms.get(label);
  bucket.push(ms);
  // Trim to ring-buffer size
  if (bucket.length > MAX_HISTOGRAM_SAMPLES) {
    bucket.splice(0, bucket.length - MAX_HISTOGRAM_SAMPLES);
  }
}

/**
 * Compute percentile statistics for a histogram bucket.
 * @param {string} label
 * @returns {{ count: number, min: number, max: number, avg: number, p50: number, p95: number, p99: number } | null}
 */
function getHistogramStats(label) {
  const bucket = histograms.get(label);
  if (!bucket || bucket.length === 0) return null;

  const sorted = [...bucket].sort((a, b) => a - b);
  const len = sorted.length;
  const percentile = (p) => sorted[Math.ceil(len * p / 100) - 1];

  return {
    count: len,
    min: sorted[0],
    max: sorted[len - 1],
    avg: Math.round(sorted.reduce((s, v) => s + v, 0) / len),
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

// ──────────────────────────────────────────────
// Snapshot
// ──────────────────────────────────────────────

/**
 * Returns a full snapshot of all metrics suitable for the monitoring API.
 * @returns {object}
 */
function snapshot() {
  const allCounters = Object.fromEntries(counters);
  const allGauges = Object.fromEntries(gauges);

  const responseTimeSummary = {};
  for (const [label] of histograms) {
    const stats = getHistogramStats(label);
    if (stats) responseTimeSummary[label] = stats;
  }

  // Derived: error rate = errors / total_requests (expressed as %)
  const totalRequests = allCounters['http.requests.total'] ?? 0;
  const totalErrors = allCounters['http.requests.errors'] ?? 0;
  const errorRate = totalRequests > 0
    ? parseFloat(((totalErrors / totalRequests) * 100).toFixed(2))
    : 0;

  return {
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    counters: allCounters,
    gauges: allGauges,
    errorRate,
    responseTimes: responseTimeSummary,
  };
}

/**
 * Reset all metrics (useful in tests).
 */
function reset() {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

module.exports = {
  increment,
  getCounter,
  setGauge,
  getGauge,
  recordResponseTime,
  getHistogramStats,
  snapshot,
  reset,
};
