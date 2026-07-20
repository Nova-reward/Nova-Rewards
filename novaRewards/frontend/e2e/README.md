# E2E Test Suite - Reward Issuance Flow

This directory contains end-to-end (E2E) tests for the Nova Rewards reward issuance flow, covering the complete critical user journey from merchant registration to on-chain balance confirmation.

## Overview

The E2E test suite validates the full reward issuance workflow:

1. **Merchant Registration** - Create a new merchant account
2. **Merchant Login** - Authenticate as the merchant
3. **Campaign Creation** - Create a reward campaign with token amount
4. **Reward Issuance** - Issue reward to a test user wallet
5. **Balance Confirmation** - Poll and verify balance reflects the issued reward

## Test Files

### `reward-issuance-flow.spec.js` (Main Test)
The comprehensive test suite covering the full reward issuance flow:
- ✅ Complete merchant-to-user reward flow
- ✅ Freighter API mocking with auto-approval
- ✅ Balance polling with 30-second timeout
- ✅ Error handling for edge cases
- ✅ Descriptive test.step() annotations

**Key test steps:**
- `should complete full reward issuance flow from merchant registration to balance confirmation`
- `should handle insufficient balance during reward issuance`

### `mobile-overflow.spec.js`
UI/responsive design tests (optional)

## Prerequisites

### System Requirements
- Node.js 18+ (use `nvm use` if available)
- PostgreSQL 14+
- Redis 6+
- Docker and Docker Compose (for container-based testing)

### Installation

```bash
# Install frontend dependencies (including Playwright)
cd novaRewards/frontend
npm install

# Install Playwright browsers (one-time setup)
npx playwright install

# Install backend dependencies
cd ../backend
npm install
```

### Environment Setup

Create `.env.testnet` in the project root:

```bash
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Backend
DATABASE_URL=postgresql://postgres:password@localhost:5432/nova_rewards_test
REDIS_URL=redis://localhost:6379

# Stellar Testnet
TESTNET_USER_WALLET=GBRPYHIL2CI3WHSCULVRJC3P4ABWOY4XHALUKYAPXL73MRLN42HDA5O
TESTNET_ISSUER_PUBLIC=GDQOE23CFSUMSVQK4Y5R3ZARVIVTD4XVXUUJX3SP27YMGNXC2OGXJVM
```

## Running Tests Locally

### Quick Start (All Services)

```bash
# 1. Start all required services (PostgreSQL, Redis, backend, frontend)
npm run test:e2e:local

# 2. In another terminal, run the tests
cd novaRewards/frontend
npm run test:e2e
```

### Step-by-Step Setup

```bash
# 1. Start PostgreSQL (Docker)
docker run -d \
  --name postgres-test \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# 2. Start Redis (Docker)
docker run -d \
  --name redis-test \
  -p 6379:6379 \
  redis:7-alpine

# 3. Setup database and seed test data
cd novaRewards/backend
npm run migrate:test
npm run seed:test

# 4. Start backend server
npm run dev &

# 5. Start frontend dev server
cd ../frontend
npm run dev &

# 6. Run E2E tests in new terminal
npm run test:e2e
```

### Running Specific Tests

```bash
# Run reward issuance flow test only
npm run test:e2e -- reward-issuance-flow.spec.js

# Run with UI mode (visual debugging)
npm run test:e2e:ui

# Run in headed mode (see browser)
npx playwright test reward-issuance-flow.spec.js --headed

# Run with verbose output
npx playwright test reward-issuance-flow.spec.js --verbose

# Run single test case
npx playwright test reward-issuance-flow.spec.js -g "should complete full reward issuance"

# Debug a specific test
npx playwright test reward-issuance-flow.spec.js --debug
```

## Running Tests in CI/CD

The GitHub Actions workflow automatically:

1. Starts PostgreSQL and Redis services
2. Installs dependencies
3. Runs database migrations
4. Seeds test data
5. Starts backend and frontend servers
6. Runs full E2E test suite
7. Uploads HTML report and test results

**Trigger:**
- On push to `main`, `develop`, or `feature/e2e-*` branches
- On pull requests to `main` or `develop`
- Daily at 2 AM UTC (scheduled)

**View results:**
```bash
# Pull request comment includes quick summary
# Detailed report in GitHub Actions artifacts section
```

## Freighter API Mocking

The tests use a **mocked Freighter API** (no browser extension required):

```javascript
// Auto-injected by the test via page.addInitScript()
window.freighterApi = {
  isConnected: async () => true,
  requestAccess: async () => ({ error: null, isAllowed: true }),
  getPublicKey: async () => ({ publicKey: 'GBRPYHIL2CI3WHSCULVRJC3P4ABWOY4XHALUKYAPXL73MRLN42HDA5O', error: null }),
  signTransaction: async (xdr) => ({ signedTxXdr: xdr, error: null }),
};
```

**Why mock instead of using the real extension?**
- ✅ Works in headless CI environments
- ✅ Auto-approves transactions (deterministic)
- ✅ No installation/setup required
- ✅ Consistent across test runs
- ✅ No dependency on browser extension updates

## Balance Polling Logic

The tests include robust balance polling to avoid flaky timeouts:

```javascript
// Poll GET /api/users/{id}/balance until:
// - Balance >= expected amount, OR
// - 30 seconds elapsed
// - Exponential backoff: 1s → 2s → 4s → 5s
```

**Features:**
- ✅ 30-second timeout (configurable)
- ✅ Exponential backoff (avoids API spam)
- ✅ Detailed logging of each attempt
- ✅ Graceful timeout handling

**Adjust timeout:**
```javascript
const result = await pollBalance(userId, expectedAmount, 60000); // 60 seconds
```

## Test Data Management

### Seeding Test Data

```bash
# Run seed script directly
cd novaRewards/backend
node scripts/seed-test-data.js

# Or via npm script
npm run seed:test
```

**Creates:**
- ✅ Test merchant account with unique email
- ✅ Test user with Stellar wallet
- ✅ Test campaign with 5000 token reward pool
- ✅ Initial balance (1000 tokens)
- ✅ API key for merchant authentication

### Test Data Output

```
✅ Test merchant created: merchant-1234567890@test.nova-rewards.com
   Merchant ID: 1
   API Key: abc123def456ghi789

👤 Test user created: GBRPYHIL2CI3WHSCULVRJC3P4ABWOY4XHALUKYAPXL73MRLN42HDA5O
   User ID: 1

🎯 Test campaign created: E2E Test Campaign 1234567890
   Campaign ID: 1

💝 Test reward created: 100 tokens
   Reward ID: 1

💰 User balance initialized: 1000 tokens
```

## Debugging & Troubleshooting

### Common Issues

#### "Connection refused" errors
**Problem:** Backend/frontend not running  
**Solution:**
```bash
# Verify services running
lsof -i :3000 # Frontend
lsof -i :3001 # Backend
lsof -i :5432 # PostgreSQL

# Kill and restart if needed
npm run dev
```

#### Balance polling timeout
**Problem:** User balance not reflecting reward after 30s  
**Possible causes:**
- Backend reward processing delayed
- Database transaction not committed
- API endpoint returning stale data

**Debug:**
```bash
# Check backend logs for reward issuance errors
# Verify database transaction completed
# Check balance polling endpoint directly
curl http://localhost:3000/api/users/GBRPYHIL2CI3WHSCULVRJC3P4ABWOY4XHALUKYAPXL73MRLN42HDA5O/balance
```

#### Test selectors not found
**Problem:** Form fields/buttons not found  
**Solution:**
- Update selectors in test to match current HTML
- Use `--debug` mode to inspect elements
- Check page structure hasn't changed

#### Freighter mock not loading
**Problem:** window.freighterApi undefined  
**Solution:**
- Verify `page.addInitScript()` is called before navigation
- Check test has `injectFreighterMock(page)` in beforeEach

### Debugging Commands

```bash
# Run single test with debug mode (opens inspector)
npx playwright test reward-issuance-flow.spec.js --debug

# Run with verbose output and screenshots
npx playwright test reward-issuance-flow.spec.js --verbose --screenshot=only-on-failure

# View HTML test report
npx playwright show-report

# Slow down test execution (helpful for debugging)
npx playwright test --trace on

# Run with specific browser
npx playwright test --project=chromium
```

## Performance & Reliability

### Timeouts
- **Test timeout:** 60 seconds (global)
- **Assertion timeout:** 5 seconds
- **Balance polling:** 30 seconds
- **Web server startup:** 120 seconds

**Adjust in `playwright.config.js`:**
```javascript
timeout: 60_000, // Global
expect: { timeout: 5_000 }, // Assertions
```

### Retries & Flakiness

Current configuration:
- ✅ No automatic retries (fail fast for debugging)
- ✅ Sequential test execution (preserve state)
- ✅ 1-second sleep between steps (allow UI to update)

**To add retries:**
```javascript
test.describe.configure({ retries: 2 });
```

### CI/CD Integration

**GitHub Actions workflow:** `.github/workflows/e2e.yml`
- Runs on: push, PR, schedule (daily 2 AM UTC)
- Services: PostgreSQL, Redis (Docker)
- Reporters: HTML, JUnit, JSON
- Artifacts: Test reports (30-day retention)

## Test Coverage

### Acceptance Criteria (Issue #1145)

| Criterion | Status | Coverage |
|-----------|--------|----------|
| Merchant registration | ✅ | `test.step('Fill registration form...')` |
| Merchant login | ✅ | `test.step('Enter merchant credentials...')` |
| Campaign creation | ✅ | `test.step('Fill campaign creation form...')` |
| Reward issuance | ✅ | `test.step('Submit reward issuance form...')` |
| Balance polling (30s) | ✅ | `pollBalance(userId, amount, 30000)` |
| Freighter mock | ✅ | `injectFreighterMock(page)` |
| Headless CI support | ✅ | `.github/workflows/e2e.yml` |
| test.step() annotations | ✅ | All steps documented |
| README documentation | ✅ | This file |

## Contributing

### Adding New Tests

1. Create new `.spec.js` file in this directory
2. Use `test.step()` for each logical step
3. Inject Freighter mock in `beforeEach()`
4. Use descriptive test names
5. Add comments for complex logic

**Example:**
```javascript
test('should complete some flow', async ({ page }) => {
  await injectFreighterMock(page);
  
  await test.step('Do something', async () => {
    await page.goto('/page');
    await page.click('button');
  });
  
  await test.step('Verify result', async () => {
    expect(await page.textContent()).toContain('success');
  });
});
```

### Running Tests Locally During Development

```bash
# Watch mode - re-run on file changes
npx playwright test --watch

# UI mode - visual debugging with timeline
npx playwright test --ui

# Headed mode - see browser
npx playwright test --headed
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Stellar SDK](https://developers.stellar.org/docs)
- [Nova Rewards Architecture](../../docs/)

## Support

For issues or questions:
1. Check this README and troubleshooting section
2. Review test logs in `playwright-report/`
3. Open GitHub issue with test output
4. See `.github/workflows/e2e.yml` for CI configuration
