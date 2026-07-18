# Error Handling

All errors follow this format:

## Error Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message"
}

## Common Errors

| Code | Description |
|------|------------|
| INVALID_TOKEN | Token expired or invalid |
| UNAUTHORIZED | Missing authentication |
| NOT_FOUND | Resource not found |
| RATE_LIMIT_EXCEEDED | Too many requests |