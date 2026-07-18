# ADR 0001: Layered PWA and Express API

## Status

Accepted

## Context

Nova Rewards supports user wallet flows, merchant campaign management, admin
operations, and public API integrations. The frontend needs browser wallet
access through Freighter, while privileged actions such as merchant
authentication, reward issuance, webhook delivery, and database writes need
server-side controls.

## Decision

Use a layered web architecture:

- `novaRewards/frontend` provides the Next.js PWA, wallet UI, API clients,
  contexts, and user-facing state.
- `novaRewards/backend` provides the Express API, route-level authorization,
  middleware, domain services, repositories, workers, and observability.
- Nginx or Kubernetes Ingress routes external traffic to the frontend and API.

The browser never receives server signing secrets. Wallet interactions that need
user approval stay in the browser through Freighter, while backend-owned
operations stay behind Express middleware.

## Consequences

Positive:

- The frontend can evolve quickly without embedding privileged blockchain or
database credentials.
- API middleware gives one place for auth, rate limits, audit logging, metrics,
  tracing, and consistent error handling.
- The same API surface supports the PWA, merchant integrations, and tests.

Negative:

- Frontend and backend contracts must be kept in sync through OpenAPI/Pact tests.
- Some flows cross more boundaries than a monolith, so tracing and correlation
  IDs matter.

## Related

- Diagram: [System Design - Component Diagram](../system-design.md#component-diagram)
- Code: `novaRewards/frontend/lib/api.js`
- Code: `novaRewards/backend/server.js`
- Code: `deployment/nginx/nginx.conf`
- Code: `helm/nova-rewards/templates/ingress.yaml`

