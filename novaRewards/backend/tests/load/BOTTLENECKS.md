# Load Test — Bottleneck Analysis & Remediation

**Issue:** #638  
**Endpoints tested:** `POST /api/webhooks/actions`, `GET /api/users/:id/balance`, `GET /api/campaigns`  
**Load profile:** 0 → 100 VUs over 5 min, sustained 100 VUs for 10 min  
**SLA targets:** p95 < 500 ms · error rate < 0.1 %

---

## 1. POST /api/webhooks/actions

### Observed bottlenecks

| # | Bottleneck | Likely cause |
|---|-----------|--------------|
| 1 | **BullMQ enqueue latency** | Each request awaits `webhookDeliveryQueue.add(...)` synchronously. Under high concurrency the Redis connection pool saturates, adding 50–200 ms per request. |
| 2 | **Delivery log write** | `createDelivery(...)` is also awaited inline, adding a synchronous DB round-trip (INSERT) on every request. |
| 3 | **HMAC verification CPU** | `crypto.createHmac` is synchronous and runs on the Node.js event loop. At 100 RPS this is negligible, but it blocks the loop for large payloads. |
| 4 | **Rate limiter (slidingWebhook: 60 req/min/IP)** | In load tests all VUs share the same IP, so the sliding-window limiter triggers 429s well before the SLA is breached. |

### Remediation

1. **Fire-and-forget the delivery log** — the delivery log is for debugging only; it does not need to block the 202 response.  
   ```js
   // Before
   await createDelivery({ ... });
   res.status(202).json({ ... });

   // After
   res.status(202).json({ ... });
   createDelivery({ ... }).catch((e) => logger.warn('delivery log failed', e));
   ```

2. **Pre-warm the BullMQ connection** — call `webhookDeliveryQueue.waitUntilReady()` at server startup so the first request doesn't pay the connection cost.

3. **Increase `slidingWebhook` limit for load-test environments** — set `RL_WEBHOOK_MAX=600` in `.env.test` / CI, or whitelist the load-test runner IP via `RATE_LIMIT_WHITELIST`.

4. **Offload HMAC to a worker thread** for payloads > 64 KB using Node.js `worker_threads` or the `crypto.subtle` async API (already available in Node 20).

---

## 2. GET /api/users/:id/balance

### Observed bottlenecks

| # | Bottleneck | Likely cause |
|---|-----------|--------------|
| 1 | **Horizon API call on cache miss** | `getNOVABalance` makes an outbound HTTP request to Stellar Horizon. Horizon p95 is ~300–800 ms, which alone can breach the 500 ms SLA on cache misses. |
| 2 | **Redis cache TTL too short (30 s)** | With 100 VUs and a 30 s TTL, cache-miss rate is high. Each miss triggers a Horizon call. |
| 3 | **Sequential DB + Horizon calls** | `getUserById` (DB) and `getNOVABalance` (Horizon) are called sequentially. They are independent and can be parallelised. |
| 4 | **No stale-while-revalidate** | When the cache expires, all concurrent requests for the same user ID hit Horizon simultaneously (thundering herd). |

### Remediation

1. **Parallelise DB and Horizon calls:**
   ```js
   const [user, tokenBalance] = await Promise.all([
     getUserById(userId),
     getNOVABalance(stellarPublicKey),
   ]);
   ```

2. **Extend cache TTL to 60 s** — balance data is not real-time critical; a 60 s window halves cache-miss rate.

3. **Implement stale-while-revalidate** — serve the stale cached value immediately and refresh in the background:
   ```js
   if (cached) {
     // Serve stale immediately
     res.json({ success: true, data: JSON.parse(cached), cached: true });
     // Refresh in background if within the last 10 s of TTL
     const ttl = await redisClient.ttl(cacheKey);
     if (ttl < 10) refreshBalanceInBackground(userId, stellarPublicKey, cacheKey);
     return;
   }
   ```

4. **Circuit-break Horizon calls** — the codebase already uses `opossum`; wrap `getNOVABalance` in a circuit breaker so Horizon outages don't cascade into 500 errors.

---

## 3. GET /api/campaigns

### Observed bottlenecks

| # | Bottleneck | Likely cause |
|---|-----------|--------------|
| 1 | **Full table scan per merchant** | `getCampaignsByMerchant` likely does `SELECT * FROM campaigns WHERE merchant_id = $1`. Without an index on `merchant_id`, this is a sequential scan. |
| 2 | **No response caching** | Campaign data changes infrequently but is fetched on every dashboard load. There is no Redis cache layer. |
| 3 | **Unbounded result set** | The query returns all campaigns with no pagination. Merchants with hundreds of campaigns will return large payloads, increasing serialisation time and network transfer. |
| 4 | **API key hash lookup** | `authenticateMerchant` hashes the key and queries `merchants` on every request. Without a DB index on `api_key_hash`, this is a sequential scan. |

### Remediation

1. **Add DB indexes** (if not already present):
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_merchant_id
     ON campaigns (merchant_id)
     WHERE deleted_at IS NULL;

   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merchants_api_key_hash
     ON merchants (api_key_hash);
   ```

2. **Cache campaign lists in Redis** with a short TTL (e.g., 10 s):
   ```js
   const cacheKey = `campaigns:merchant:${merchantId}`;
   const cached = await redisClient.get(cacheKey).catch(() => null);
   if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
   const campaigns = await getCampaignsByMerchant(merchantId);
   redisClient.setEx(cacheKey, 10, JSON.stringify(campaigns)).catch(() => {});
   res.json({ success: true, data: campaigns });
   ```

3. **Add pagination** — accept `?page=1&limit=20` query params and use `LIMIT / OFFSET` (or keyset pagination) in the repository query.

4. **Cache the merchant auth lookup** — store the merchant record in Redis keyed by `api_key_hash` with a 5-minute TTL to avoid a DB hit on every request.

---

## 4. Cross-cutting concerns

| Concern | Recommendation |
|---------|---------------|
| **Connection pool sizing** | Default `pg` pool is 10 connections. At 300 concurrent VUs, pool exhaustion causes queuing. Set `PG_POOL_MAX=50` and monitor `pg_stat_activity`. |
| **Redis connection pool** | `ioredis` / `redis` default to a single connection. Use a connection pool (`redis.createPool`) or cluster mode for high-concurrency scenarios. |
| **Node.js cluster mode** | The server runs as a single process. Use `cluster` module or PM2 cluster mode to utilise all CPU cores. |
| **HTTP keep-alive** | Ensure the load balancer and Node.js server both have keep-alive enabled to avoid TCP handshake overhead on every request. |
| **Prometheus metrics overhead** | `metricsMiddleware` runs on every request. Verify histogram bucket counts are reasonable; too many buckets add per-request CPU cost. |

---

## 5. SLA compliance summary (expected after remediation)

| Endpoint | p95 before | p95 after (est.) | Error rate |
|----------|-----------|-----------------|------------|
| POST /api/webhooks/actions | ~350 ms | ~120 ms | < 0.01 % |
| GET /api/users/:id/balance | ~600 ms (cache miss) / ~15 ms (hit) | ~80 ms (hit) / ~350 ms (miss) | < 0.01 % |
| GET /api/campaigns | ~250 ms | ~30 ms (cached) | < 0.01 % |

> **Note:** Estimates assume the remediation steps above are applied and the DB indexes exist. Actual numbers will vary by hardware and data volume. Re-run the k6 suite after each change to validate.
