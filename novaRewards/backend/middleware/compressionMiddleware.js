'use strict';

/**
 * Compression middleware
 *
 * Applies gzip compression (with brotli negotiation handled transparently by
 * the `compression` package) to all JSON/text responses above the configured
 * byte threshold.  Streaming responses (SSE, chunked transfer without a
 * Content-Length) are left untouched because the `compression` package only
 * buffers and compresses responses that have already set Content-Length or
 * that go through `res.json()` / `res.send()`.  Manually piped streams that
 * call `res.write()` directly will still be compressed incrementally — which
 * is fine — unless the caller has already set `Content-Encoding` themselves,
 * in which case we skip compression via the `filter` function below.
 *
 * Environment variables
 * ─────────────────────
 * COMPRESSION_LEVEL     zlib level 0–9 (default 6).  Use -1 for zlib default.
 * COMPRESSION_THRESHOLD minimum response size in bytes before compression is
 *                        applied (default 1024, i.e. 1 KB).
 */

const compression = require('compression');

/**
 * Parse an integer env var, returning `fallback` when the var is absent or
 * not a valid integer.
 *
 * @param {string} name        env var name
 * @param {number} fallback    value used when the var is missing / invalid
 * @param {number} [min]       optional lower bound (inclusive)
 * @param {number} [max]       optional upper bound (inclusive)
 * @returns {number}
 */
function parseIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    console.warn(
      `[compression] ${name}="${raw}" is not a valid integer — using default ${fallback}`
    );
    return fallback;
  }

  if (min !== undefined && parsed < min) {
    console.warn(
      `[compression] ${name}=${parsed} is below minimum ${min} — clamping to ${min}`
    );
    return min;
  }
  if (max !== undefined && parsed > max) {
    console.warn(
      `[compression] ${name}=${parsed} exceeds maximum ${max} — clamping to ${max}`
    );
    return max;
  }

  return parsed;
}

const level = parseIntEnv('COMPRESSION_LEVEL', 6, -1, 9);
const threshold = parseIntEnv('COMPRESSION_THRESHOLD', 1024, 0);

/**
 * Filter function — tells the `compression` package whether to compress a
 * given response.
 *
 * We skip compression when:
 *  • The response already carries a Content-Encoding header (e.g. a proxied
 *    response or a route that handles its own encoding).
 *  • The default `compression` filter rejects the content-type (e.g. images,
 *    binary streams that are already compressed).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function shouldCompress(req, res) {
  // Respect any encoding that a downstream handler has already applied.
  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  // Delegate to the library's built-in content-type filter.
  return compression.filter(req, res);
}

const compressionMiddleware = compression({
  level,
  threshold,
  filter: shouldCompress,
});

module.exports = { compressionMiddleware };
