# NovaRewards API Documentation

OpenAPI 3.0 documentation for the Nova Rewards backend REST API.

---

## Accessing the Swagger UI

### Local development

Start the backend server:

```bash
cd novaRewards/backend
npm run dev
```

Open your browser at:

```
http://localhost:3001/api/docs
```

### Production

The `/api/docs` route is protected by HTTP Basic Auth in production.

Set the following environment variables on your server:

```
DOCS_USER=nova          # username (default: nova)
DOCS_PASS=<your-secret> # password — leave unset to disable the gate
```

When prompted by the browser, enter the credentials above.

---

## Importing `openapi.json` into Postman

1. Open Postman and click **Import** (top-left).
2. Select the **File** tab and choose `docs/api/openapi.json` from this repository.
3. Postman will create a new collection with all 31 endpoints pre-configured, including example request bodies.
4. Set the `baseUrl` variable to `http://localhost:3001/api` (or your production URL).

To regenerate `openapi.json` after route changes:

```bash
cd novaRewards/backend
npm run generate:openapi
```

---

## Using Bearer Token Authentication in the Swagger UI

Most user-facing endpoints require a JWT Bearer token.

1. Call `POST /auth/login` with your email and password.
2. Copy the `accessToken` value from the response.
3. In the Swagger UI, click the **Authorize** button (🔒) at the top-right.
4. In the **bearerAuth** field, paste the token (without the `Bearer ` prefix — Swagger adds it automatically).
5. Click **Authorize**, then **Close**.

All subsequent requests from the UI will include the `Authorization: Bearer <token>` header.

---

## Using Merchant API Key Authentication

Merchant endpoints use an `x-api-key` header instead of a Bearer token.

1. Register a merchant via `POST /merchants/register` — the plain-text API key is returned **once** in the response. Store it securely.
2. In the Swagger UI, click **Authorize** (🔒).
3. In the **merchantApiKey** field, paste the API key.
4. Click **Authorize**, then **Close**.

---

## Authentication Quick Reference

| Endpoint group | Auth method |
|---------------|-------------|
| `POST /auth/*` | None (public) |
| `POST /users` | None (public) |
| `GET /users/:walletAddress/points` | None (public) |
| `GET /campaigns/:merchantId` | None (public) |
| `GET /users/:id`, `PATCH`, `DELETE` | Bearer JWT |
| `GET /redemptions`, `POST /redemptions` | Bearer JWT |
| `GET /leaderboard` | Bearer JWT |
| `GET /admin/*` | Bearer JWT (admin role) |
| `GET /drops/eligible`, `POST /drops/:id/claim` | Bearer JWT |
| `POST /rewards/distribute` | Merchant API key |
| `POST /campaigns`, `GET /campaigns` | Merchant API key |
| `GET /contract-events` | Merchant API key |
| `GET /admin/email-logs` | Merchant API key |
| `GET /transactions/merchant-totals` | Merchant API key |

---

## Live OpenAPI JSON endpoint

When the server is running, the spec is also served at:

```
GET /api/docs/openapi.json
```

This is useful for CI pipelines that need to validate or diff the spec automatically.
