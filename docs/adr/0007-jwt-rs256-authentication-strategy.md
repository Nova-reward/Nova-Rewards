# ADR 0007: JWT RS256 Authentication Strategy

## Status

Accepted

## Context

Nova Rewards needs to authenticate three distinct principals: end users (wallet
holders), merchants (API integrations), and admins (platform operators). The
initial implementation used a symmetric HS256 JWT secret, which means any
service that can verify tokens can also forge them. As the platform scales to
multiple backend services and the API surface grows, a shared secret becomes a
liability.

The system also needs token revocation for logout and security incidents, and
short-lived access tokens with a secure refresh mechanism to limit the blast
radius of a stolen token.

Considered options:

1. **HS256 symmetric JWT** — single shared secret, simple to implement, but
   any verifier can also issue tokens.
2. **RS256 asymmetric JWT** — private key signs, public key verifies; verifiers
   cannot forge tokens.
3. **Opaque session tokens** — server-side sessions stored in Redis or
   PostgreSQL; stateful, requires lookup on every request.
4. **Third-party identity provider (Auth0, Cognito)** — offloads auth
   complexity but adds external dependency and cost.

## Decision

Use RS256 asymmetric JWT with a short-lived access token / long-lived refresh
token pair, backed by a Redis revocation blocklist:

- **Access tokens** are signed with a 2048-bit RSA private key (`JWT_PRIVATE_KEY`),
  expire in 15 minutes, and carry only `sub` (wallet address) and `roles`.
- **Refresh tokens** expire in 7 days, carry a unique `jti` (JWT ID), and are
  stored in Redis on issue. Each use rotates the refresh token (old `jti` is
  deleted, new one is issued), preventing replay.
- **Revocation** is handled by adding a `jti` to a Redis blocklist with a TTL
  matching the token's remaining lifetime. Every authenticated request checks
  the blocklist before accepting the token.
- **Merchant authentication** uses API keys (separate from user JWTs) validated
  by the `authenticateMerchant` middleware.
- **Admin access** is enforced by a `requireAdmin` middleware that checks the
  `role` field on the user record loaded from PostgreSQL.

The public key (`JWT_PUBLIC_KEY`) can be distributed to any service that needs
to verify tokens without granting it the ability to issue new ones.

## Consequences

Positive:

- Compromised verifier services cannot forge tokens.
- Short-lived access tokens limit the window of a stolen token without requiring
  a database lookup on every request.
- Refresh token rotation detects token theft: if a rotated token is replayed,
  the mismatch is detectable.
- The Redis blocklist enables immediate revocation for logout and security
  incidents.
- RS256 is compatible with standard JWT libraries and JWKS endpoints for future
  federation.

Negative:

- RSA key pair management adds operational overhead: keys must be generated,
  stored in AWS Secrets Manager, and rotated periodically.
- The Redis blocklist introduces a soft dependency: if Redis is unavailable,
  revocation checks fail open (tokens cannot be invalidated until Redis
  recovers).
- Refresh token rotation requires clients to handle `401` responses and retry
  with the new token atomically to avoid race conditions on concurrent requests.

## Related

- Code: `novaRewards/backend/services/tokenService.js`
- Code: `novaRewards/backend/middleware/authenticateUser.js`
- Code: `novaRewards/backend/middleware/authenticateMerchant.js`
- Code: `novaRewards/backend/routes/auth.js`
- Code: `novaRewards/backend/scripts/generate-jwt-keys.js`
- ADR: [0002 — PostgreSQL and Redis](0002-postgresql-system-of-record-with-redis-operational-cache.md)
