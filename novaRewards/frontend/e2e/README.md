# Nova Rewards E2E Test Suite

Complete Playwright end-to-end test suite for Nova Rewards blockchain loyalty platform. Runs on desktop and mobile browsers with comprehensive mocking for wallet and backend APIs.

## Quick Start

### Local Development (5 minutes)

```bash
# 1. Terminal 1: Start backend services
cd novaRewards
docker-compose up -d

# 2. Terminal 2: Start frontend dev server
cd frontend
npm run dev

# 3. Terminal 3: Run E2E tests
cd novaRewards/frontend
npx playwright test --project=desktop-chromium
```

**Expected:**
- ✅ Tests pass in ~90 seconds
- ✅ HTML report opens on failure (local only)
- ✅ All 10+ test scenarios pass

### GitHub Actions (Automatic)

Tests run automatically on:
- Push to `main`
- Pull requests to `main`

Results:
- ✅ HTML report uploaded as artifact
- ✅ Screenshots/traces on failure
- ✅ PR comments with test summary

## Test Execution

### All Tests (Desktop)
```bash
npx playwright test --project=desktop-chromium
```

### Specific Test File
```bash
npx playwright test e2e/merchant-reward-flow.spec.js --project=desktop-chromium
```

### Single Test
```bash
npx playwright test -g "Merchant registers, creates campaign" --project=desktop-chromium
```

### Interactive UI Mode
```bash
npx playwright test --ui --project=desktop-chromium
```

### Debug Mode
```bash
npx playwright test --debug --project=desktop-chromium
```

### Mobile Layout Tests
```bash
# Pixel 5 (Chromium)
npx playwright test --project=chromium-mobile

# iPhone 12 (WebKit)
npx playwright test --project=webkit-mobile

# Both
npx playwright test --project=chromium-mobile --project=webkit-mobile
```

## Docker & CI Setup

### Local Docker Testing

```bash
# Start all services with health checks
cd novaRewards
docker-compose up --wait

# In another terminal: seed test data (optional)
docker exec nova-rewards-backend node scripts/seed-test-data.js

# Run tests
cd frontend
npx playwright test --project=desktop-chromium
```

### GitHub Actions (Automatic)

The `.github/workflows/e2e.yml` workflow:

1. **Starts PostgreSQL** with health checks
2. **Installs Node.js** and dependencies
3. **Runs migrations** on test database
4. **Seeds test data** (reference wallet addresses)
5. **Starts backend** on port 3001
6. **Installs Playwright** browsers
7. **Runs all tests** with desktop-chromium project
8. **Uploads artifacts** (report, traces, screenshots)
9. **Comments on PR** with test summary

## Architecture

### Test Structure

```
fixtures/           # Deterministic test data (RUN_SUFFIX prevents collisions)
  └─ merchants.js, campaigns.js, rewards.js, constants.js

helpers/            # Reusable workflows (30+ functions)
  ├─ authHelper.js        (register/login API & UI)
  ├─ campaignHelper.js    (campaign creation)
  ├─ rewardHelper.js      (distribution & polling)
  ├─ testApiClient.js     (retry logic, assertions)
  ├─ freighterMockBuilder.js (wallet mock with tracking)
  ├─ pollingHelper.js     (exponential backoff)
  └─ mockSetup.js         (backend route mocks)

pages/              # Page objects (UI encapsulation)
  ├─ MerchantPortalPage.js
  └─ CustomerDashboardPage.js

*.spec.js           # Test scenarios
  ├─ merchant-reward-flow.spec.js (happy path)
  ├─ merchant-reward-errors.spec.js (error paths)
  └─ reward-issuance.spec.js (existing tests)
```

### Mock Strategy

**Layer 1: Freighter Wallet** (Browser-side)
```javascript
await page.addInitScript(script, arg);
// window.freighterApi = { isConnected, getPublicKey, signTransaction }
```

**Layer 2: Backend APIs** (Playwright routes)
```
POST /api/trustline/verify    → { exists: true }
POST /api/rewards/distribute  → { txHash: 'mock-...' }
GET /api/users/:wallet/points → { balance: 0 | expected }
```

**Layer 3: Error Scenarios** (Separate mocks)
```
setupMockNoTrustline()    → "no trustline" error
setupMockExpiredCampaign() → "campaign expired" error
setupMockRateLimit()      → 429 rate limit
```

### Test Flow

```
test.step("Install mocks")
  ├─ Freighter mock (browser-side)
  └─ Backend mocks (Playwright routes)

test.step("Register merchant via UI")
  ├─ Fill form (name, wallet, category)
  ├─ Submit
  └─ Capture API key

test.step("Create campaign via UI")
  ├─ Fill form (name, rate, dates)
  ├─ Submit
  └─ Verify success

test.step("Issue reward via UI")
  ├─ Select campaign
  ├─ Fill wallet & amount
  ├─ Submit
  └─ Verify TX link

test.step("Poll balance")
  ├─ GET /api/users/:wallet/points
  ├─ Exponential backoff (500ms → 4s)
  └─ Assert balance updated
```

## Playwright Configuration

**File:** `playwright.config.js`

### Projects
- `desktop-chromium` — All feature tests (register, campaign, reward, balance)
- `chromium-mobile` — Pixel 5 layout tests
- `webkit-mobile` — iPhone 12 layout tests

### Environment Variables
```
PLAYWRIGHT_FRONTEND_URL=http://localhost:3000
PLAYWRIGHT_BACKEND_URL=http://localhost:3001
CI=true  # Set by GitHub Actions
```

### CI/CD Behavior
```
Local Development:
  - Retries: 0 (fail fast)
  - Workers: 2 (avoid backend overload)
  - Server reuse: true (faster iteration)

GitHub Actions:
  - Retries: 1 (absorb transient issues)
  - Workers: all CPUs (parallel execution)
  - Server reuse: false (fresh start)
  - Artifacts: HTML report, traces, screenshots, videos
```

### Timeouts
```
Test timeout:     60s (includes polling)
Global timeout:   30m (entire suite)
Navigation:       30s
Action:           15s
Polling:          30s (with exponential backoff)
```

## Artifacts & Debugging

### Generated on Failure (CI Only)

```
playwright-report/             # HTML report with screenshots
test-results/
  ├─ junit.xml                # Test results for CI parsing
  ├─ traces/                  # Full browser traces
  ├─ screenshots/             # Failure screenshots
  └─ videos/                  # Test videos
```

### View Locally

```bash
# After tests run:
npx playwright show-report

# Or open directly:
open novaRewards/frontend/playwright-report/index.html
```

## Key Features

### ✅ test.step() Hierarchy
Every action wrapped for visibility in reports:
- Install mocks
- Navigate pages
- Fill forms
- Submit actions
- Wait for results
- Poll balance
- Verify results

### ✅ Deterministic Data
All fixtures use `RUN_SUFFIX = Date.now().toString(36)` to create unique test identities:
```javascript
const merchantName = `E2E Merchant ${RUN_SUFFIX}`;
// e.g., "E2E Merchant 2pxk9l"
```

### ✅ Exponential Backoff Polling
Smart polling for balance updates:
```
Attempt 1: delay 500ms   → failed
Attempt 2: delay 1000ms  → failed
Attempt 3: delay 2000ms  → failed
Attempt 4: delay 4000ms  → SUCCESS ✓
```

### ✅ Freighter Mock
Complete wallet mock with tracking:
```javascript
const { script, arg } = buildAdvancedFreighterMock({
  publicKey: STELLAR_WALLETS.customer1,
  autoApprove: true,
  responseDelayMs: 500,
});
await page.addInitScript(script, arg);

// Later: verify it was used
const tracking = await getFreighterMockTracking(page);
console.log('Sign requests:', tracking.signRequests.length);
```

### ✅ Descriptive Assertions
All assertions include context:
```javascript
expect(balance, 'Balance should be >= 10').toBeGreaterThanOrEqual(10);
expect(apiKey, 'API key should be 32 hex').toMatch(/^[0-9a-f]{32}$/i);
```

## Test Coverage

| Scenario | File | Duration |
|----------|------|----------|
| Happy path: register → campaign → reward → balance | `merchant-reward-flow.spec.js` | ~30s |
| Error: no trustline | `merchant-reward-errors.spec.js` | ~10s |
| Error: expired campaign | `merchant-reward-errors.spec.js` | ~10s |
| Error: invalid wallet | `merchant-reward-errors.spec.js` | ~10s |
| Error: rate limit | `merchant-reward-errors.spec.js` | ~10s |
| Existing tests (preserved) | `reward-issuance.spec.js` | ~30s |
| Mobile layout | `mobile-overflow.spec.js` | ~10s |

**Total: 10+ scenarios in ~90 seconds**

## Documentation

- **This file:** Quick start and execution guide
- `FREIGHTER_MOCK_DOCUMENTATION.md` — Wallet mock details
- `IMPLEMENTATION_COMPLETE.md` — Architecture and quality standards
- `../.kiro/E2E_DESIGN_*.md` — Design phase documentation

## Troubleshooting

### Tests Timeout
**Problem:** Balance polling exceeds 30 seconds  
**Solution:** Check backend mocks are installed correctly. Verify curl returns 200:
```bash
curl -s http://localhost:3001/health | grep -q '"status":"ok"'
```

### Freighter Mock Not Working
**Problem:** Wallet signing fails  
**Solution:** Verify addInitScript is called BEFORE navigation:
```javascript
await page.addInitScript(script, arg);
await page.goto('/merchant'); // AFTER mock installed
```

### Port Already in Use
**Problem:** Backend won't start (3001 taken)  
**Solution:** Kill existing processes:
```bash
lsof -i :3001
kill -9 <PID>
```

### Database Migration Fails
**Problem:** Tables already exist  
**Solution:** The migrations are idempotent (use CREATE IF NOT EXISTS), so it's safe to re-run. Or reset:
```bash
docker-compose down -v
docker-compose up -d
```

## Integration with Stellar Testnet

### For Manual Testing (Not in CI)

E2E tests are designed for mocking to prevent:
- Dependency on live Stellar testnet
- Real transaction submission
- Variable timing issues

To test against actual Stellar testnet:

1. **Remove Playwright mocks** from test file
2. **Use real backend** (with DISTRIBUTION_SECRET configured)
3. **Use real Freighter extension** (not mock)
4. **Add significant delays** for Horizon API (testnet can be slow)

**Example:**
```javascript
// Instead of mock, call real backend:
const { txHash } = await issueRewardViaAPI(apiClient, rewardData, apiKey);

// Instead of mock polling, wait for Horizon:
await waitForHorizonConfirmation(txHash, { timeoutMs: 120_000 });
```

However, **this is not recommended for CI/CD**. The mocked tests are:
- ✅ Deterministic
- ✅ Fast (~90 seconds)
- ✅ No external dependencies
- ✅ Perfect for validating UI/flow logic

## Common Commands

```bash
# All tests
npx playwright test

# Desktop only
npx playwright test --project=desktop-chromium

# Mobile only
npx playwright test --project=chromium-mobile --project=webkit-mobile

# Specific test file
npx playwright test merchant-reward-flow.spec.js

# Specific test
npx playwright test -g "Merchant registers"

# Debug mode
npx playwright test --debug

# UI mode (interactive)
npx playwright test --ui

# View report
npx playwright show-report

# List tests (without running)
npx playwright test --list
```

## Environment Setup

### Local Development
```bash
# Start backend
cd novaRewards
docker-compose up -d

# Verify backend
curl http://localhost:3001/health

# Install frontend deps
cd frontend
npm install

# Run tests
npx playwright test
```

### Docker (No Docker Compose)
```bash
# If running backend outside Docker:
npm install
NODE_ENV=test npm start  # Runs on :3001

# Then from frontend:
npx playwright test
```

### CI (GitHub Actions)
```yaml
# Handled by .github/workflows/e2e.yml
# Automatically:
# 1. Starts PostgreSQL service
# 2. Runs migrations
# 3. Seeds test data
# 4. Starts backend
# 5. Runs E2E tests
# 6. Uploads artifacts
```

## Support

For issues or questions:

1. **Check logs:**
   ```bash
   # Backend logs
   docker logs nova-rewards-backend

   # Frontend dev server
   # (visible in terminal where npm run dev started)
   ```

2. **Review test output:**
   ```bash
   # HTML report
   npx playwright show-report

   # Console output
   # (in terminal where tests ran)
   ```

3. **Debug mode:**
   ```bash
   npx playwright test --debug
   # Pauses at each step, use inspector to examine page state
   ```

4. **Check CI logs:**
   - GitHub Actions: Repository → Actions → E2E Tests → Click run → View logs

---

**Status:** ✅ Ready to run

```bash
npx playwright test --project=desktop-chromium
```

