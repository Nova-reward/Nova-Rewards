# NovaRewards API Versioning

NovaRewards uses URL versioning for public API stability.

## Current version

- Current version: `v1`
- Current base URL: `/api/v1`
- Legacy base URL: `/api`

The unversioned `/api` path remains a backward-compatible alias for `v1`, but new integrations should call `/api/v1`.

## Discovery endpoint

Call `GET /api/versions` or `GET /api/v1/versions` to inspect the current version, supported versions, legacy status, and sunset date.

## Deprecation headers

Requests served through the legacy `/api` path include:

- `X-API-Version: v1`
- `X-API-Deprecated: true`
- `Deprecation: true`
- `Sunset: 2027-01-01`
- `Link: </api/v1>; rel="successor-version"`
- `X-API-Migration-Guide: /api/versioning`

Requests served through `/api/v1` include:

- `X-API-Version: v1`
- `X-API-Deprecated: false`

## Migration guide

Migration is path-only for v1:

| Legacy route | Versioned route |
|---|---|
| `POST /api/auth/login` | `POST /api/v1/auth/login` |
| `GET /api/campaigns` | `GET /api/v1/campaigns` |
| `GET /api/wallet/balance` | `GET /api/v1/wallet/balance` |
| `POST /api/webhooks` | `POST /api/v1/webhooks` |

Request payloads, authentication headers, response envelopes, and error formats are unchanged.

## Sunset policy

NovaRewards will keep the legacy `/api` alias available until `2027-01-01`. Before removing or changing a version, the API should:

1. Publish the successor version in OpenAPI servers and API docs.
2. Return deprecation and sunset headers for the retiring version.
3. Keep a migration guide with route and schema changes.
4. Maintain both versions during the announced migration window.
