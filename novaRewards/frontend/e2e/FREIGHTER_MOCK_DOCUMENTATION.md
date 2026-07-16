# Freighter Wallet Mock Documentation

## Overview

The Freighter wallet mock allows E2E tests to run in headless Chromium without requiring the actual Freighter browser extension. It's injected into the browser context before any page scripts load, providing a deterministic stub that simulates wallet behavior.

**Files:**
- `helpers/freighterMock.js` — Original mock builder (from project)
- `helpers/freighterMockBuilder.js` — Advanced version with tracking and delays

---

## Architecture

### Problem

Freighter is a browser extension that:
- Cannot be installed in headless Chromium
- Cannot be mocked at the extension API level
- Is required by `lib/freighter.js` to sign transactions

### Solution

**Injection via `page.addInitScript()`**

```javascript
// Before any page JavaScript runs:
await page.addInitScript(script, arg);
// Now window.freighterApi is available everywhere
```

The stub replaces:
1. `window.freighterApi` (extension global)
2. `window.__FREIGHTER_API_OVERRIDE__` (escape hatch for tests)

---

## API Contract

The mock implements the `@stellar/freighter-api` v2 surface:

```typescript
interface FreighterAPI {
  isConnected(): Promise<{ isConnected: boolean }>
  requestAccess(): Promise<{}>  // No error field = success
  getPublicKey(): Promise<{ publicKey: string }>
  signTransaction(xdr: string): Promise<{ signedTxXdr?: string, error?: string }>
}
```

---

## Usage Examples

### Basic Mock (Happy Path)

```javascript
import { buildAdvancedFreighterMock } from './helpers/freighterMockBuilder.js';

test('user connects wallet and signs transaction', async ({ page }) => {
  const { script, arg } = buildAdvancedFreighterMock({
    publicKey: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
    autoApprove: true,
    responseDelayMs: 100, // Simulate extension latency
  });

  await page.addInitScript(script, arg);
  
  // Now any wallet calls will use the mock
  await page.goto('/');
  // Freighter calls proceed without real extension
});
```

### Mock with Rejection (Test Error Path)

```javascript
const { script, arg } = buildAdvancedFreighterMock({
  publicKey: 'GDQGIY5...',
  autoApprove: false, // Reject all sign requests
});

await page.addInitScript(script, arg);

// Now signTransaction() returns { error: 'User declined...' }
```

### Mock Tracking (Verification)

```javascript
import {
  getFreighterMockTracking,
  assertFreighterSignCount,
} from './helpers/freighterMockBuilder.js';

test('wallet is used to sign payment', async ({ page }) => {
  // ... setup mock, perform actions ...

  // Verify mock was called
  const tracking = await getFreighterMockTracking(page);
  console.log('Sign requests:', tracking.signRequests.length);
  console.log('Get public key calls:', tracking.getPublicKeyRequests);

  // Or use helper
  await assertFreighterSignCount(page, 1); // Expect exactly 1 sign call
});
```

---

## Mock State

### Initialization

```javascript
window.__freighterMockTracking = {
  signRequests: [],          // Array of { xdr, timestamp }
  getPublicKeyRequests: 0,   // Counter
  requestAccessRequests: 0,  // Counter
};
```

### During Test

The mock tracks all API calls and allows inspection via:

```javascript
// In browser context:
window.__freighterMockTracking.signRequests
  // [{ xdr: '...', timestamp: 1234567890 }, ...]

// From test:
const tracking = await getFreighterMockTracking(page);
```

### Reset

```javascript
import { resetFreighterMockTracking } from './helpers/freighterMockBuilder.js';

await resetFreighterMockTracking(page);
// tracking state clears for next assertion
```

---

## Timing & Delays

### Response Delays

The mock can simulate extension latency:

```javascript
buildAdvancedFreighterMock({
  responseDelayMs: 500, // All responses delayed 500ms
})
```

This helps test async UX like loading spinners.

### Implementation

```javascript
async getPublicKey() {
  await delay(cfg.responseDelayMs);  // Simulate network/extension delay
  return { publicKey: cfg.publicKey };
}
```

---

## Integration with Backend Mocks

Freighter mock + Backend mocks work together:

```
┌─────────────┐
│ Test Code   │
└──────┬──────┘
       │
       ├─→ [Browser] Freighter Mock
       │   └─ page.addInitScript()
       │   └ window.freighterApi stub
       │
       ├─→ [Playwright] Route Mocks
       │   └ page.route('**/api/...')
       │   └ Intercept backend calls
       │
       └─→ [Node] API Client
           └ Real polling (if backend live)
```

**Example:**

```javascript
// Freighter signs XDR (mocked, instant)
const { signedTxXdr } = await window.freighterApi.signTransaction(xdr);

// Frontend submits to backend API (mocked by Playwright)
const response = await fetch('/api/rewards/distribute', {
  body: JSON.stringify({ ..., signedTxXdr })
});
// response.json() → { success: true, txHash: '...' } (from mock)

// Test polls balance (mocked)
const balance = await fetch('/api/users/:wallet/points');
// balance → { data: { balance: 10 } } (from mock)
```

---

## Configuration Options

```typescript
interface MockConfig {
  publicKey: string;              // Required: Stellar address the mock exposes
  autoApprove?: boolean;          // Optional: default true (auto-approve all signs)
  responseDelayMs?: number;       // Optional: default 100ms
}
```

---

## Error Paths

### User Rejects Sign

```javascript
buildAdvancedFreighterMock({
  autoApprove: false,
})
// Any signTransaction() call returns:
// { error: 'User declined to sign transaction' }
```

### Test Code Must Handle

```javascript
const result = await freighterApi.signTransaction(xdr);
if (result.error) {
  // Handle rejection (as frontend would)
  throw new Error(result.error);
}
// Process signedTxXdr
```

---

## Compatibility

### With Frontend Code

The mock is transparent to frontend code because it patches the same globals:

```javascript
// lib/freighter.js
import { isConnected } from '@stellar/freighter-api';

// This import is bundled at build time, but the frontend checks
// window.__FREIGHTER_API_OVERRIDE__ at runtime, so the mock works.
```

### With Multiple Tabs

Each test gets its own browser context → independent mock instances.

---

## Debugging

### Log All API Calls

```javascript
const tracking = await getFreighterMockTracking(page);

console.log('Mock state:', {
  signRequests: tracking.signRequests.length,
  publicKeyRequests: tracking.getPublicKeyRequests,
  requestAccessRequests: tracking.requestAccessRequests,
});
```

### Browser Console

Inside test:

```javascript
await page.evaluate(() => {
  console.log('Freighter mock tracking:', window.__freighterMockTracking);
});
```

### Inspect XDR

```javascript
const tracking = await getFreighterMockTracking(page);
tracking.signRequests.forEach(req => {
  console.log('Signed XDR:', req.xdr.substring(0, 50), '...');
});
```

---

## Testing the Mock Itself

Use `freighterMockBuilder.spec.js` (if created) to verify:

```javascript
test('mock returns public key', async ({ page }) => {
  const { script, arg } = buildAdvancedFreighterMock({
    publicKey: 'GTEST...',
  });
  await page.addInitScript(script, arg);

  const result = await page.evaluate(
    () => window.freighterApi.getPublicKey()
  );
  expect(result.publicKey).toBe('GTEST...');
});
```

---

## Limitations

1. **No Real Signing**: XDR is returned unchanged (Stellar doesn't validate it in tests)
2. **No Extension State**: Mock doesn't track real wallet balances
3. **Synchronous Responder**: Playwright evaluations wait for promises
4. **Test-Only**: Freighter extension still required for production

---

## Future Enhancements

- [ ] Configurable rejection patterns (e.g., reject on certain XDR)
- [ ] Multi-account support (switch accounts mid-test)
- [ ] Balance tracking in mock state
- [ ] Custom error messages per test

---

## References

- **Freighter API**: https://www.npmjs.com/package/@stellar/freighter-api
- **Playwright Scripts**: https://playwright.dev/docs/api/class-page#page-add-init-script
- **Nova Rewards Frontend**: `/workspaces/Nova-Rewards/novaRewards/frontend/lib/freighter.js`

