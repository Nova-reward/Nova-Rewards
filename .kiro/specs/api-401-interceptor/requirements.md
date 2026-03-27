# Requirements Document

## Introduction

This feature adds a response interceptor to the central axios instance (`novaRewards/frontend/lib/api.js`) in the NovaRewards frontend. When any backend call returns a 401 (Unauthorized) status — indicating an invalid or expired API key — the interceptor redirects the merchant to a re-authentication page so they can obtain a fresh API key. This prevents merchants from silently operating with an invalid key and provides a clear recovery path.

## Glossary

- **Interceptor**: An axios response interceptor that runs on every HTTP response before it reaches the calling code.
- **API_Client**: The axios instance exported from `novaRewards/frontend/lib/api.js`.
- **Reauth_Page**: The dedicated Next.js page (`/reauth`) that informs the merchant their session is invalid and prompts them to re-register or return to the merchant portal.
- **Merchant**: A business user who has registered on the merchant portal and holds an API key used to authorise reward distributions.
- **Router**: The Next.js `next/router` instance used for client-side navigation.

## Requirements

### Requirement 1: Attach Response Interceptor to API Client

**User Story:** As a merchant, I want invalid API key errors to be handled automatically, so that I am not left in a broken state when my session expires.

#### Acceptance Criteria

1. THE API_Client SHALL attach exactly one response interceptor at module initialisation time.
2. WHEN a response with HTTP status 200–299 is received, THE API_Client SHALL pass the response through to the calling code unchanged.
3. WHEN a response with HTTP status 401 is received, THE Interceptor SHALL redirect the browser to the `/reauth` route using the Next.js Router.
4. WHEN a response with an HTTP status other than 401 is received and the status is outside 200–299, THE Interceptor SHALL re-throw the error so the calling code can handle it normally.

### Requirement 2: Re-authentication Page

**User Story:** As a merchant, I want a clear re-authentication page, so that I understand why I was redirected and know how to recover access.

#### Acceptance Criteria

1. THE Reauth_Page SHALL render a human-readable message explaining that the API key is invalid or has expired.
2. THE Reauth_Page SHALL provide a navigation link that returns the merchant to `/merchant` so they can re-register and obtain a new API key.
3. THE Reauth_Page SHALL NOT require any authenticated state or API key to render.

### Requirement 3: Interceptor Idempotency

**User Story:** As a developer, I want the interceptor to be registered only once, so that 401 responses do not trigger multiple redirects.

#### Acceptance Criteria

1. THE API_Client SHALL register the response interceptor exactly once across the lifetime of the module.
2. WHEN the module is imported multiple times within the same application session, THE API_Client SHALL NOT attach duplicate interceptors.

### Requirement 4: Non-Interference with Existing Error Handling

**User Story:** As a developer, I want non-401 errors to continue propagating normally, so that existing try/catch blocks in the application are not broken.

#### Acceptance Criteria

1. WHEN a response error with a status code other than 401 is received, THE Interceptor SHALL re-throw the original error object without modification.
2. WHEN a network error with no response object is received, THE Interceptor SHALL re-throw the error without triggering a redirect.
3. WHEN a 401 redirect is triggered, THE Interceptor SHALL still reject the original promise so any calling code that awaits the request receives a rejected promise rather than hanging indefinitely.
