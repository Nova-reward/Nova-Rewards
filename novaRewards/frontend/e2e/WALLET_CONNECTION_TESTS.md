# E2E Tests: Wallet Connection Flow (#953)

Comprehensive Playwright E2E tests for the Freighter wallet connection flow, covering all user journeys and error scenarios.

## Overview

These tests validate the complete wallet connection lifecycle:
- ✅ Clicking "Connect Wallet" triggers the wallet selection modal with Freighter, Albedo, and xBull options
- ✅ Connected wallet address appears in the header after successful connection
- ✅ Disconnecting clears the session and returns to the connect state
- ✅ "Freighter not installed" modal appears when the browser extension is absent
- ✅ Network mismatch detection and error messaging
- ✅ Session persistence across page reloads
- ✅ Error recovery and user-friendly error messages

## Files

### `helpers.js` (Extended)
New utility functions for mocking the Freighter extension in E2E tests:

- **`mockFreighterExtension(page, options)`** — Injects a mocked Freighter API into the page context
  - Options: `installed`, `authorized`, `publicKey`, `network`, `networkPassphrase`, `networkMismatch`, `accessDenialError`
  
- **`authorizeFreighter(page)`** — Simulates user approving Freighter access

- **`setUpConnectedFreighterWallet(page, options)`** — Shorthand to set up a fully connected wallet state

- **`mockHorizonAPI(page, options)`** — Mocks Horizon API responses for balance and transaction queries

### `wallet-connection.spec.js`
Main test suite with 15+ test scenarios covering:

#### Connection Flow Tests
1. **Opening wallet picker** — Click "Connect Wallet" → modal with wallet options appears
2. **Selecting Freighter** — Click Freighter option → initiate connection with mocked extension

#### Connected Wallet Display Tests
3. **Wallet address visible** — After connection, truncated address appears in header
4. **Full address in detail view** — Complete public key visible in wallet section
5. **Balance display** — NOVA balance fetched and displayed

#### Disconnect Tests
6. **Disconnect clears session** — Click disconnect → wallet removed from localStorage → connect button returns
7. **Wallet info removed from UI** — After disconnect, address and balance no longer visible

#### Not Installed Tests
8. **Error when extension absent** — Freighter not installed → error message displayed
9. **Install modal appears** — Prompt to install Freighter extension
10. **Close install modal** — User can dismiss modal without installing

#### Network Mismatch Tests
11. **Error on network mismatch** — Freighter on wrong network (e.g., PUBLIC vs TESTNET) → error shown
12. **Success on network match** — Networks align → connection succeeds

#### Session Persistence Tests
13. **Persist across reloads** — Wallet stays connected after page reload
14. **Balance refresh** — Balance updates after connection

#### Advanced Tests
15. **Switch wallet types** — User can disconnect Freighter and connect Albedo
16. **Access denied recovery** — User denies access → graceful error → can retry
17. **Generic connection failure** — Connection fails → error message → can retry

## Running the Tests

### Locally

Run all E2E tests:
```bash
cd novaRewards/frontend
npm run test:e2e
```

Run only wallet connection tests:
```bash
npx playwright test wallet-connection.spec.js
```

Run with UI mode (interactive):
```bash
npm run test:e2e:ui
```

Run specific test:
```bash
npx playwright test wallet-connection.spec.js -g "displays connected wallet address"
```

Run with specific browser:
```bash
npx playwright test wallet-connection.spec.js --project=chromium
```

Run in debug mode:
```bash
npx playwright test wallet-connection.spec.js --debug
```

### In CI

The GitHub Actions workflow (`.github/workflows/e2e.yml`) automatically:
- Runs tests on every push to `main` and on pull requests
- Tests against Chromium, Firefox, and WebKit browsers
- Uses headless mode (automatically enabled by Playwright on Linux)
- Uploads HTML reports and visual snapshots on failure
- Retries failed tests up to 2 times
- Reports results to GitHub

To run locally as CI would:
```bash
cd novaRewards/frontend
CI=true npx playwright test wallet-connection.spec.js
```

## Mocking Strategy

### Freighter Extension Mock

The tests inject a mock Freighter API using Playwright's `addInitScript`:

```javascript
await mockFreighterExtension(page, {
  installed: true,              // Whether extension is available
  authorized: true,             // Whether user has granted access
  publicKey: '...',             // Mock wallet address
  network: 'TESTNET',           // Expected network
  networkPassphrase: '...',     // Network identifier
  networkMismatch: false,       // Simulate network conflict
  accessDenialError: null,      // Simulate user denial or error
});
```

### Horizon API Mock

Mocks Stellar Horizon API responses to avoid external network calls:

```javascript
await mockHorizonAPI(page, {
  balance: '1000.0000000',
  transactions: [],
});
```

Routes intercepted:
- `**/api/v1/accounts/**` — Account details (balances)
- `**/api/v1/accounts/**/transactions**` — Transaction history
- `**/api/v1/accounts/**/operations**` — Operations history

## Test Scenarios

### Scenario 1: Happy Path (Install → Connect → Use)
1. User clicks "Connect Wallet"
2. Freighter option appears in picker
3. User clicks Freighter
4. Wallet address appears in header
5. User can disconnect

**Test:** `displays connected wallet address in the header after successful connection`

### Scenario 2: Extension Not Installed
1. User clicks "Connect Wallet"
2. User selects Freighter
3. Error: "Freighter not installed"
4. Install modal appears with link to Freighter site

**Tests:**
- `shows "Freighter not installed" error when extension is absent`
- `Freighter install modal displays when extension check fails`

### Scenario 3: Network Mismatch
1. User has Freighter installed and authorized
2. But Freighter is on PUBLIC network, app expects TESTNET
3. Connection attempt detects mismatch
4. Error shown: "Network mismatch" or "Wrong network"

**Test:** `shows error when Freighter is on the wrong network`

### Scenario 4: Session Persistence
1. User connects wallet
2. Page reloads (or new tab)
3. Wallet remains connected (loaded from localStorage)
4. No re-authorization needed

**Test:** `wallet connection persists across page reloads`

### Scenario 5: Error Recovery
1. User clicks "Connect Wallet"
2. Connection denied or fails
3. User sees error message
4. User can try again immediately

**Tests:**
- `recovers gracefully when connection is denied by user`
- `shows clear error message when connection attempt fails`

## Key Implementation Details

### localStorage Keys
- `walletPublicKey` — Connected wallet address
- `walletType` — Wallet type ('freighter', 'albedo', 'xbull', 'walletconnect')

### UI Selectors Used
- Connect button: `button:has-text("Connect Wallet")`
- Disconnect button: `button:has-text("Disconnect")`
- Wallet picker: `text=Choose a wallet`
- Wallet info: `text=Wallet` or address substring
- Freighter option: `button:has-text("Freighter")`

### Error Detection Patterns
- Not installed: `/freighter|not installed|extension/i`
- Network mismatch: `/network|mismatch|wrong/i`
- Access denied: `/denied|rejected|access/i`
- Generic error: `/fail|error|unable/i`

## CI Integration

### GitHub Actions Workflow

File: `.github/workflows/e2e.yml`

Features:
- Runs on push to `main` and pull requests
- Tests 3 browsers in parallel (chromium, firefox, webkit)
- Headless mode enabled automatically on Linux runners
- 2 retries per failed test
- HTML report uploaded to GitHub Artifacts
- Visual snapshots on failure
- GitHub Reporter integration for inline PR feedback

### Environment Variables (CI)
```bash
CI=true                                          # Enable CI mode in Playwright config
STAGING_URL=${{ secrets.STAGING_URL }}           # Optional: run against live staging
NEXT_PUBLIC_API_URL=${{ secrets.STAGING_API_URL || 'http://localhost:3001' }}
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

## Headless Mode

Tests automatically run in headless mode when:
- `CI=true` environment variable is set
- Running on GitHub Actions (Linux)
- Using `--headed=false` flag (default)

To run with visible browser locally:
```bash
npx playwright test wallet-connection.spec.js --headed
```

## Debugging

### View test trace
```bash
npx playwright show-trace trace.zip
```

### Step through test
```bash
npx playwright test wallet-connection.spec.js --debug
```

### View generated HTML report
```bash
npx playwright show-report
```

### Check browser console during test
Tests capture console logs and include them in failure reports.

## Acceptance Criteria ✓

- [x] Test verifies that clicking "Connect Wallet" triggers the Freighter prompt (mocked)
- [x] Test verifies that the connected wallet address appears in the header after connection
- [x] Test verifies that disconnecting clears the session and shows the connect button
- [x] Test verifies the "Freighter not installed" modal appears when the extension is absent
- [x] E2E tests run in headless mode in CI

## Related Files

- **Frontend Components:**
  - `components/WalletConnect.js` — Main wallet connection UI
  - `components/FreighterInstallModal.tsx` — Install prompt modal
  - `context/WalletContext.js` — Wallet state management

- **Backend/API:**
  - `lib/freighter.ts` — Freighter SDK wrapper functions
  - `lib/horizonClient.ts` — Horizon API client

- **Unit Tests:**
  - `lib/__tests__/freighter.test.ts` — Unit tests for SDK functions

## Future Enhancements

- [ ] Add tests for Albedo and xBull wallet types (with mocks)
- [ ] Test WalletConnect integration
- [ ] Add visual regression tests for wallet UI
- [ ] Test concurrent wallet connection attempts
- [ ] Add performance benchmarks for connection flow
- [ ] Test mobile-specific wallet flows

## Troubleshooting

### Tests fail locally but pass in CI
- Check `NEXT_PUBLIC_STELLAR_NETWORK` env var is set to `testnet`
- Ensure local dev server is running (`npm run dev`)
- Check for localhost:3000 accessibility

### Playwright install fails
```bash
npx playwright install --with-deps chromium
npm ci  # Reinstall all dependencies
```

### Tests timeout
- Increase timeout: `test.setTimeout(30_000);`
- Check that dev server is running
- Verify Horizon API is accessible

### Mock not working
- Check `page.addInitScript` executed before navigation
- Verify `page.goto()` happens after mock setup
- Check browser console for errors

## Contact

For questions about these tests, see:
- Issue #953 in GitHub
- Test file comments for individual test documentation
- Playwright documentation: https://playwright.dev
