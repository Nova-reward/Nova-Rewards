# Authentication

Nova Rewards API uses JWT (JSON Web Tokens).

## Login Flow

1. Send credentials to `/auth/login`
2. Receive:
   - Access token (short-lived)
   - Refresh token (long-lived)

## Example (cURL)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password"}'

## JavaScript

const res = await fetch("http://localhost:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});

## Using the Token

curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/campaigns