# Security Audit — Nova Rewards
**Date:** 2026-06-02  
**Scope:** Full backend codebase (routes, DB repositories, services, middleware) and frontend (React/Next.js)  
**Auditor:** Kiro AI security review

---

## Summary

| Category | Findings | Status |
|---|---|---|
| SQL Injection | 1 vulnerability found and fixed | ✅ Fixed |
| XSS | No vulnerabilities found | ✅ Clean |
| File Upload | 1 weakness found and hardened | ✅ Fixed |
| Auth / Access Control | Robust (JWT + role checks everywhere) | ✅ Clean |
| Sensitive Data Exposure | Email encryption in place | ✅ Clean |

---

## Findings and Fixes

### 1. SQL Injection — `getUnprocessedReferrals` (CRITICAL)

**File:** `novaRewards/backend/db/userRepository.js`  
**OWASP:** A03:2021 – Injection

**Before:**
```js
AND u.referred_at <= NOW() - INTERVAL '${hoursAgo} hours'
// hoursAgo embedded directly into SQL via template literal
```

**After:**
```js
AND u.referred_at <= NOW() - ($1 * INTERVAL '1 hour')
// hoursAgo passed as a parameterized value
```

**Risk:** While `hoursAgo` defaults to `24` and is an internal service parameter (not directly user-supplied via HTTP), embedding any variable in raw SQL is a violation of OWASP A03 and can become exploitable if the call path changes. Fixed by parameterizing the value.

---

### 2. XSS — No Vulnerabilities Found

**OWASP:** A03:2021 – Injection (XSS subtype)

The backend is a pure JSON API (`res.json()` throughout; no `res.send()` with raw HTML). The frontend is a React/Next.js application that auto-escapes all JSX interpolation by design. No usage of `dangerouslySetInnerHTML` was found in any component.

No fixes required.

---

### 3. File Upload — Magic-Byte Bypass (HIGH)

**File:** `novaRewards/backend/routes/users.js` — `POST /api/users/:id/profile-picture`  
**OWASP:** A04:2021 – Insecure Design / A08:2021 – Software and Data Integrity Failures

**Before:**  
Multer's `fileFilter` relied solely on the client-supplied `Content-Type` header (MIME type). An attacker could rename a malicious file `evil.php` → `evil.jpg` and supply `Content-Type: image/jpeg` to bypass the check.

**After (three-gate validation):**

| Gate | What it checks | Bypass resistance |
|---|---|---|
| Gate 1 | File extension whitelist (`.jpg/.jpeg/.png/.webp`) | Blocks wrong-extension uploads at the transport layer |
| Gate 2 | Client `Content-Type` header | Defence-in-depth layer |
| Gate 3 | Magic-byte signature of saved file bytes | Cannot be spoofed; reads actual file content |

On magic-byte failure, the uploaded file is deleted before the error is returned. No new runtime dependencies were added — magic-byte detection uses Node.js built-in `fs` synchronous reads.

---

## OWASP Top 10 (2021) Checklist

| # | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | ✅ | Every route enforces `authenticateUser`; ownership checks (`requireOwnershipOrAdmin`) on user-scoped routes; admin routes use `requireAdmin`; merchant routes use `authenticateMerchant` with API key |
| A02 | Cryptographic Failures | ✅ | Emails encrypted at rest (`lib/encryption.js`); passwords hashed with bcrypt (12 rounds); JWT signed with RS256 asymmetric keys; HTTPS enforced via Nginx; field-level encryption via `lib/prismaEncryptionMiddleware.js` |
| A03 | Injection | ✅ Fixed | SQL injection in `getUnprocessedReferrals` fixed. All other DB queries use parameterized statements throughout all 20+ repository files. Elasticsearch queries in `searchService.js` use the official client's structured query DSL — no raw string interpolation. |
| A04 | Insecure Design | ✅ Fixed | File upload hardened with three-gate content validation. Referral bonus endpoint validates IDs; reward issuance follows a DB-first, on-chain-confirm pattern |
| A05 | Security Misconfiguration | ✅ | Helmet.js applied globally for HTTP security headers; CORS configured; rate limiting via `rateLimiter.js` and `slidingRateLimiter.js`; abuse detection middleware blocks suspicious patterns |
| A06 | Vulnerable & Outdated Components | ⚠️ Ongoing | Dependencies should be periodically audited with `npm audit`. No known critical CVEs at time of this review. |
| A07 | Identification and Authentication Failures | ✅ | JWT access + refresh token pattern; password minimum complexity enforced; bcrypt with 12 rounds; Stellar wallet-based auth via signed challenge (SEP-10 pattern) |
| A08 | Software & Data Integrity Failures | ✅ Fixed | File upload magic-byte check prevents polyglot file injection. Webhook signatures verified in `webhookService.js`. |
| A09 | Security Logging & Monitoring Failures | ✅ | Comprehensive `auditMiddleware.js` logs every request with actor, action, IP, HTTP method, endpoint, duration, and status code. `securityAlertService.js` raises alerts on anomalies. Prometheus + Grafana for runtime metrics. |
| A10 | Server-Side Request Forgery (SSRF) | ✅ | Outbound HTTP calls go only to Stellar Horizon RPC and Soroban (configured via env vars, not user-supplied URLs). Webhook target URLs are stored on merchant creation, not per-request user input. |

---

## Recommendations (Non-blocking)

1. **`npm audit` on CI** — Add `npm audit --audit-level=high` as a CI step to catch newly published CVEs in dependencies.
2. **Content-Security-Policy** — The Nginx config should set a strict `Content-Security-Policy` header for the frontend, especially `default-src 'self'` and a restrictive `script-src`.
3. **Avatar serving** — Avatars stored under `frontend/public/avatars/` are served as static files by Next.js. Consider serving them from a separate origin (e.g., a CDN or presigned S3 URL) to limit the blast radius if a malicious file were ever served.
4. **`since` parameter in search analytics** — `GET /api/search/analytics/top-queries?since=...` passes user input directly to a PostgreSQL `INTERVAL` cast. This is currently safe because it's cast via `$1::INTERVAL` (parameterized), but the value is not validated against an allowlist. Consider restricting to `['1 day', '7 days', '30 days', '90 days']`.
5. **Rate-limit file uploads** — The profile-picture endpoint should have a tighter per-user rate limit to prevent disk exhaustion (e.g., max 5 uploads/hour per user).
