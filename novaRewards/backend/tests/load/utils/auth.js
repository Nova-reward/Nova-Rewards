/**
 * k6 auth helpers
 *
 * Generates a valid HMAC-SHA256 signature for POST /api/webhooks/actions
 * and provides a helper to build the Authorization header for user endpoints.
 *
 * NOTE: k6 ships with a built-in `crypto` module — no npm install needed.
 */
import { crypto } from 'k6/experimental/webcrypto';

/**
 * Compute HMAC-SHA256 hex digest of `payload` using `secret`.
 * Used to sign inbound webhook requests.
 *
 * @param {string} secret  - INBOUND_WEBHOOK_SECRET value
 * @param {string} payload - JSON-stringified request body
 * @returns {Promise<string>} hex digest
 */
export async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a Bearer Authorization header value from a pre-issued JWT.
 *
 * In a real environment the token would be obtained via POST /api/auth/login.
 * For load testing we accept a pre-generated long-lived token via the
 * K6_USER_TOKEN environment variable so we don't hammer the auth endpoint.
 *
 * @param {string} token
 * @returns {string}
 */
export function bearerHeader(token) {
  return `Bearer ${token}`;
}
