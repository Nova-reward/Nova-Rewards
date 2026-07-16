# E2E Suite Design - Part 5: Architecture Summary & Implementation Checklist

## Architecture Overview

### File Organization

```
frontend/e2e/
├── fixtures/
│   ├── merchants.js                    # Merchant test data (valid, invalid variants)
│   ├── campaigns.js                    # Campaign test data
│   ├── rewards.js                      # Reward distribution test data
│   ├── users.js                        # User registration/login test data
│   ├── constants.ts                    # Global configuration & timeouts
│   └── index.js                        # Re-export all fixtures
│
├── helpers/
│   ├── testApiClient.js                # Extended API client (logging, retry, assertions)
│   ├── freighterMockBuilder.js         # Advanced Freighter mock (delays, tracking)
│   ├── pollingHelper.js                # Reusable polling (elements, balance, predicates)
│   ├── mockSetup.js                    # Backend API mock configuration
│   ├── authHelper.js                   # User/merchant auth (API & UI)
│   ├── campaignHelper.js               # Campaign creation (API & UI)
│   └── rewardHelper.js                 # Reward distribution & balance polling
│
├── pages/
│   ├── MerchantPortalPage.js          # Page object for /merchant
│   └── CustomerDashboardPage.js        # Page object for /dashboard
│
├── merchant-reward-flow.spec.js        # Primary happy-path test (full flow)
├── merchant-reward-errors.spec.js      # Error path tests (no trustline, expired, etc.)
├── mobile-overflow.spec.js             # Existing mobile layout tests
└── reward-issuance.spec.js             # Existing single test (can be refactored)
```

---

## Data Flow Diagram

```
                        ┌─────────────────────────────────────┐
                        │   FIXTURES (Deterministic Data)     │
                        │                                     │
                        │  merchants.js   (name, wallet, …)  │
                        │  campaigns.js   (name, rate, …)    │
                        │  rewards.js     (wallet, amount)    │
                        │  users.js       (email, password)   │
                        │  constants.ts   (timeouts, URLs)    │
                        └────────┬────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           ┌────────▼──────────┐    ┌────────▼──────────┐
           │   TEST FILE       │    │  TEST FILE        │
           │                   │    │                   │
           │ merchant-reward   │    │ merchant-reward   │
           │ -flow.spec.js     │    │ -errors.spec.js   │
           │                   │    │                   │
           └────────┬──────────┘    └────────┬──────────┘
                    │                         │
        ┌───────────┼─────────────────────────┼──────────────┐
        │           │                         │              │
        │  ┌────────▼─────────────┐  ┌──────▼──────────┐    │
        │  │   PAGE OBJECTS      │  │   HELPERS       │    │
        │  │                     │  │                 │    │
        │  │ MerchantPortalPage  │  │ authHelper      │    │
        │  │ CustomerDashboard   │  │ campaignHelper  │    │
        │  │                     │  │ rewardHelper    │    │
        │  │ (Selectors)         │  │ (Workflows)     │    │
        │  └─────────────────────┘  └────────────────┘    │
        │                                                   │
        │  ┌──────────────────────────────────────────┐   │
        │  │   UTILITY HELPERS                        │   │
        │  │                                          │   │
        │  │ testApiClient     (retry, logging)      │   │
        │  │ freighterMock     (delays, tracking)    │   │
        │  │ pollingHelper     (exponential backoff) │   │
        │  │ mockSetup         (route mocking)       │   │
        │  └──────────────────────────────────────────┘   │
        │                                                   │
        └───────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐        ┌───▼────┐
   │ BROWSER │        │ BACKEND │        │STELLAR │
   │         │        │   API   │        │TESTNET │
   │Freighter│        │(mocked) │        │(mocked)│
   │ Mock    │        │Routes   │        │Horizon │
   └─────────┘        └─────────┘        └────────┘
```

---

## Implementation Steps

### Phase 1: Create Fixtures (Lowest Risk)
**Files to create:**
1. ✅ `frontend/e2e/fixtures/merchants.js`
2. ✅ `frontend/e2e/fixtures/campaigns.js`
3. ✅ `frontend/e2e/fixtures/rewards.js`
4. ✅ `frontend/e2e/fixtures/users.js`
5. ✅ `frontend/e2e/fixtures/constants.ts`
6. ✅ `frontend/e2e/fixtures/index.js` (re-export all)

**Validation:** All fixtures should be pure functions with no external dependencies.

---

### Phase 2: Create Utility Helpers
**Files to create:**
1. ✅ `frontend/e2e/helpers/testApiClient.js`
   - Extends existing `createApiClient()`
   - Adds: error assertions, retry logic, logging
2. ✅ `frontend/e2e/helpers/freighterMockBuilder.js`
   - Extends existing `buildFreighterMockScript()`
   - Adds: response delays, signing request tracking
3. ✅ `frontend/e2e/helpers/pollingHelper.js`
   - Generic polling logic (reusable across tests)
   - Exponential backoff, timeout handling
4. ✅ `frontend/e2e/helpers/mockSetup.js`
   - Centralized backend route mocking
   - Separate setups for error scenarios

---

### Phase 3: Create Page Objects
**Files to create:**
1. ✅ `frontend/e2e/pages/MerchantPortalPage.js`
   - Encapsulates /merchant UI interactions
   - Methods: register, createCampaign, issueReward, etc.
2. ✅ `frontend/e2e/pages/CustomerDashboardPage.js`
   - Encapsulates /dashboard UI interactions
   - Methods: connectWallet, setupTrustline, etc.

**Validation:** All selectors should be resilient (use accessible labels + role-based queries).

---

### Phase 4: Create Business Logic Helpers
**Files to create:**
1. ✅ `frontend/e2e/helpers/authHelper.js`
   - `registerUserViaAPI()`, `loginUserViaAPI()`
   - `registerUserViaUI()`, `loginUserViaUI()`
   - `registerMerchantViaAPI()`, `registerMerchantViaUI()`
   - `isMerchantAuthenticated()`
2. ✅ `frontend/e2e/helpers/campaignHelper.js`
   - `createCampaignViaAPI()`
   - `createCampaignViaUI()`
   - `listCampaignsViaAPI()`
3. ✅ `frontend/e2e/helpers/rewardHelper.js`
   - `issueRewardViaAPI()`
   - `issueRewardViaUI()`
   - `waitForBalanceUpdate()`

**Validation:** All helpers should use `test.step()` for hierarchical reporting.

---

### Phase 5: Create Test Files
**Files to create:**
1. ✅ `frontend/e2e/merchant-reward-flow.spec.js`
   - Happy-path: merchant registration → campaign creation → reward issuance → balance poll
   - All steps wrapped in `test.step()`
   - Installs mocks before navigation
2. ✅ `frontend/e2e/merchant-reward-errors.spec.js`
   - Error scenarios: no trustline, expired campaign, invalid wallet, rate limit
   - Each test isolated with separate merchant/campaign

**Validation:** Tests should pass locally and in CI with proper reporting.

---

## Test Execution Flow (Detailed)

### Main Happy-Path Test: `merchant-reward-flow.spec.js`

```javascript
test("Merchant registers, creates campaign, issues rewards, and balance is reflected")
  │
  ├─ test.step("Install Freighter wallet mock")
  │  ├─ buildAdvancedFreighterMock({ publicKey, autoApprove: true, responseDelayMs })
  │  └─ page.addInitScript(script, arg)
  │
  ├─ test.step("Install backend API mocks")
  │  ├─ setupBackendMocks(page, { expectedBalance })
  │  └─ page.route('**/api/...', fulfill)
  │
  ├─ test.step("Navigate to merchant portal")
  │  └─ page.goto('/merchant')
  │
  ├─ test.step("Register merchant via UI")
  │  └─ registerMerchantViaUI(page, merchantData)
  │     ├─ Fill form fields
  │     ├─ Submit
  │     └─ Capture API key
  │
  ├─ test.step("Verify merchant authenticated")
  │  └─ isMerchantAuthenticated(page)
  │
  ├─ test.step("Create campaign via UI")
  │  └─ createCampaignViaUI(page, campaignData)
  │     ├─ Fill form fields
  │     ├─ Submit
  │     └─ Wait for success
  │
  ├─ test.step("Verify campaign visible in table")
  │  └─ portalPage.isCampaignVisible(name)
  │
  ├─ test.step("Issue reward via UI")
  │  └─ issueRewardViaUI(page, rewardData)
  │     ├─ Select campaign
  │     ├─ Fill wallet & amount
  │     ├─ Submit
  │     └─ Capture TX hash
  │
  ├─ test.step("Verify transaction hash link")
  │  └─ Assert link contains stellar.expert + testnet + txHash
  │
  ├─ test.step("Poll for balance update")
  │  └─ waitForBalanceUpdate(apiClient, wallet, amount)
  │     ├─ pollBalanceUntilReady()
  │     └─ Exponential backoff until timeout
  │
  ├─ test.step("Verify Freighter mock was used")
  │  └─ getFreighterMockTracking(page)
  │
  ├─ test.step("Verify transaction format")
  │  └─ Assert mock-tx-hash format
  │
  └─ test.step("Test complete")
     └─ Log summary
```

---

## Mock Configuration Strategy

### Freighter Mock (Browser-Side)
```javascript
// Injected before page loads via page.addInitScript()
window.freighterApi = {
  isConnected: () => Promise.resolve({ isConnected: true }),
  requestAccess: () => Promise.resolve({}),
  getPublicKey: () => Promise.resolve({ publicKey: TEST_WALLET }),
  signTransaction: (xdr) => Promise.resolve({ signedTxXdr: xdr }),
};

window.__freighterMockTracking = {
  signRequests: [],
  getPublicKeyRequests: 0,
  requestAccessRequests: 0,
};
```

### Backend API Mocks (Playwright Routes)
```javascript
// POST /api/trustline/verify
route.fulfill({ body: { success: true, data: { exists: true } } })

// POST /api/trustline/build
route.fulfill({ body: { xdr: 'mock-xdr' } })

// POST /api/rewards/distribute
route.fulfill({ body: { success: true, txHash: 'mock-tx-hash-...' } })

// GET /api/users/:wallet/points
route.fulfill({ body: { success: true, data: { balance: 0 | expectedBalance } } })
  // balance = 0 before distribute, expectedBalance after
```

---

## Reusable Helper Function Signatures

### Auth Helpers
```typescript
registerUserViaAPI(apiClient, userData): Promise<{ user, accessToken, refreshToken }>
loginUserViaAPI(apiClient, credentials): Promise<{ accessToken, refreshToken, user }>
registerUserViaUI(page, userData): Promise<{ email }>
loginUserViaUI(page, credentials): Promise<void>
registerMerchantViaAPI(apiClient, merchantData): Promise<{ merchant, apiKey }>
registerMerchantViaUI(page, merchantData): Promise<{ merchant, apiKey }>
isMerchantAuthenticated(page): Promise<boolean>
```

### Campaign Helpers
```typescript
createCampaignViaAPI(apiClient, campaignData, apiKey): Promise<{ campaign }>
createCampaignViaUI(page, campaignData): Promise<{ campaign }>
listCampaignsViaAPI(apiClient, apiKey): Promise<Array>
```

### Reward Helpers
```typescript
issueRewardViaAPI(apiClient, rewardData, apiKey): Promise<{ txHash }>
issueRewardViaUI(page, rewardData): Promise<{ txHash }>
waitForBalanceUpdate(apiClient, walletAddress, expectedAmount, opts): Promise<{ balance, attempts, totalTimeMs }>
```

### Polling Helpers
```typescript
pollUntil(predicate, opts): Promise<{ attempts, totalTimeMs }>
pollForElement(page, selector, opts): Promise<Locator>
pollBalanceUntilReady(apiClient, wallet, amount, opts): Promise<{ balance, attempts, totalTimeMs }>
```

---

## Error Scenario Test Matrix

| Scenario | Mock | Expected | Test |
|----------|------|----------|------|
| No trustline | setupMockNoTrustline() | 400 + error | distribute blocked |
| Expired campaign | setupMockExpiredCampaign() | 400 + error | distribute blocked |
| Invalid wallet | (validation on UI) | Client error | form validation |
| Rate limit | setupMockRateLimit() | 429 | too many requests |
| Invalid dates | (validation on form) | Client error | form validation |
| Negative amount | (validation on form) | Client error | form validation |

---

## Playwright Execution Configuration

### playwright.config.js (Existing, Minor Updates)

```javascript
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? undefined : 2,
  
  use: {
    baseURL: process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/mobile-overflow.spec.js',
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/mobile-overflow.spec.js',
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

## CI/CD Integration

### .github/workflows/ci.yml (Add E2E Step)

```yaml
- name: Run Playwright E2E tests
  working-directory: novaRewards/frontend
  run: npx playwright test --project=desktop-chromium
  env:
    PLAYWRIGHT_FRONTEND_URL: http://localhost:3000
    PLAYWRIGHT_BACKEND_URL: http://localhost:3001
    CI: "true"
```

**Prerequisites:**
- Backend running on port 3001 (starts via docker-compose)
- Frontend dev server starting on port 3000 (Playwright manages via webServer)
- PostgreSQL with migrations loaded

---

## Testing Checklist (Pre-Implementation)

### Test Data Isolation
- [ ] All fixtures use `RUN_ID` to avoid DB collisions
- [ ] Factory functions ensure fresh data per test
- [ ] No hardcoded email addresses or wallet addresses

### Mock Coverage
- [ ] Freighter mock covers all @stellar/freighter-api calls
- [ ] Backend mocks cover all API routes in the flow
- [ ] Error mocks (no trustline, expired, rate limit) are separate

### Helper Reusability
- [ ] Auth helpers accept both API client & page
- [ ] Campaign helpers can be called multiple times
- [ ] Polling helpers handle timeouts gracefully
- [ ] Page objects use accessible selectors (labels, roles)

### Test Step Organization
- [ ] Each meaningful action is a separate test.step()
- [ ] Hierarchical nesting reflects user journey
- [ ] Logging at each step for debugging

### Error Testing
- [ ] Error paths tested in separate spec file
- [ ] Each error scenario has its own test
- [ ] Error messages validated

---

## Key Design Principles (Summary)

1. **Deterministic Data**: Fixtures use `RUN_ID` for uniqueness
2. **Reusable Helpers**: All helpers are pure functions (no state)
3. **Clear Separation**: Fixtures → Helpers → Page Objects → Tests
4. **API & UI Variants**: Every flow has both API-direct and UI-via-page versions
5. **Comprehensive Mocking**: Freighter mock + backend route mocks + error scenarios
6. **Test.step() Hierarchy**: Logical grouping for readability & debugging
7. **Polling with Backoff**: Balance polling uses exponential backoff (500ms → 4s)
8. **Error Path Testing**: Separate spec file for error scenarios (no happy-path pollution)
9. **Page Objects**: All UI interactions encapsulated in MerchantPortalPage, etc.
10. **Mock Isolation**: Each error scenario has its own mock setup

---

## Next Steps

1. **Verify Architecture**: Review all 4 design documents
2. **Implementation**: Create files in order (fixtures → helpers → page objects → tests)
3. **Local Testing**: Run `npx playwright test --project=desktop-chromium` locally
4. **CI Integration**: Add Playwright step to GitHub Actions
5. **Documentation**: Update README with E2E test instructions

