# Rate Limiting

The API uses rate limiting to prevent abuse.

## Limits

- 100 requests per minute per IP

## Headers

Responses include:

- X-RateLimit-Limit
- X-RateLimit-Remaining
- X-RateLimit-Reset