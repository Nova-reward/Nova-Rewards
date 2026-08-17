/**
 * Idempotency middleware — Issue #1239
 *
 * Guards POST routes against duplicate requests.  On first call the response
 * body is cached in Redis under the `Idempotency-Key` header value with a
 * 24-hour TTL.  Any subsequent request arriving with the same key within that
 * window receives the cached response with HTTP 409 Conflict instead of being
 * processed again.
 *
 * Required header
 * ---------------
 *   Idempotency-Key: <unique-string-per-request>   (missing → 400)
 *
 * Redis key format
 * ----------------
 *   idempotency:<key>
 *
 * TTL
 * ---
 *   86 400 seconds (24 hours)
 */

'use strict';

const { client: redis } = require('../lib/redis');
const logger = require('../lib/logger');

const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours
const KEY_PREFIX = 'idempotency:';

/**
 * Express middleware factory.
 *
 * Usage:
 *   const { idempotency } = require('../middleware/idempotency');
 *   router.post('/distribute', idempotency, ...handlers);
 *
 * @returns {import('express').RequestHandler}
 */
function idempotency(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return res.status(400).json({
      success: false,
      error: 'missing_idempotency_key',
      message: 'Idempotency-Key header is required',
    });
  }

  const redisKey = `${KEY_PREFIX}${idempotencyKey.trim()}`;

  // Check whether this key was already processed.
  redis
    .get(redisKey)
    .then((cached) => {
      if (cached !== null) {
        // Key exists — return the cached response body with 409 Conflict.
        let cachedBody;
        try {
          cachedBody = JSON.parse(cached);
        } catch (_) {
          cachedBody = { raw: cached };
        }
        return res.status(409).json(cachedBody);
      }

      // Key is new — let the request proceed but intercept the response so we
      // can cache its body before it is sent to the client.
      const originalJson = res.json.bind(res);

      res.json = function interceptJson(body) {
        // Only cache successful responses (2xx) to avoid storing error states.
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const serialised = JSON.stringify(body);
          redis
            .set(redisKey, serialised, { EX: IDEMPOTENCY_TTL_SECONDS })
            .catch((err) =>
              logger.error('[idempotency] failed to cache response', {
                key: redisKey,
                error: err.message,
              })
            );
        }
        return originalJson(body);
      };

      next();
    })
    .catch((err) => {
      // Redis unavailable — fail open so the request is not blocked.
      logger.error('[idempotency] Redis error, failing open', { error: err.message });
      next();
    });
}

module.exports = { idempotency };
