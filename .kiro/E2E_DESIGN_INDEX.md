# E2E Suite Design - Complete Index

This directory contains the complete design specification for the Nova Rewards E2E test suite. **No production code has been written yet** — this is purely the architecture and implementation plan.

## Design Documents (Read in Order)

### 📋 [Part 1: Test Fixtures](./E2E_DESIGN_PART1_FIXTURES.md)
**Deterministic test data generators**
- Merchant fixtures (valid, invalid variants)
- Campaign fixtures (valid, expired, invalid dates)
- Reward distribution fixtures
- User fixtures (for future auth tests)
- Global configuration constants

### 🛠️ [Part 2: Helper Utilities & Page Objects](./E2E_DESIGN_PART2_HELPERS.md)
**Reusable test infrastructure**
- Extended API client (testApiClient.js)
- Advanced Freighter mock builder
- Polling utilities (elements, balance, predicates)
- Centralized mock setup (trustline, rewards, errors)

### 📄 [Part 3: Page Objects & Login/Campaign Helpers](./E2E_DESIGN_PART3_PAGE_OBJECTS.md)
**UI abstraction & business logic workflows**
- MerchantPortalPage (page object for /merchant)
- CustomerDashboardPage (page object for /dashboard)
- Auth helpers (user registration, merchant registration, login)
- Campaign helpers (creation via API & UI)
- Reward helpers (distribution & balance polling)

### 🧪 [Part 4: Complete Test Flow](./E2E_DESIGN_PART4_TEST_FLOW.md)
**Exact Playwright execution with test.step() hierarchy**
- merchant-reward-flow.spec.js (happy path: register → campaign → reward → balance)
- merchant-reward-errors.spec.js (error paths: no trustline, expired, rate limit)
- Test flow breakdown with visual hierarchy
- Mock interaction diagram

### ✅ [Part 5: Architecture Summary & Checklist](./E2E_DESIGN_PART5_SUMMARY.md)
**High-level overview + implementation roadmap**
- File organization structure
- Data flow diagram
- Implementation phases (fixtures → helpers → page objects → tests)
- Helper function signatures
- Error scenario matrix
- Testing checklist

---

## Quick Reference

### File Structure (To Be Created)

```
frontend/e2e/
├── fixtures/
│   ├── merchants.js             # Merchant test data
│   ├── campaigns.js             # Campaign test data
│   ├── rewards.js               # Reward test data
│   ├── users.js                 # User test data
│   ├── constants.ts             # Global configuration
│   └── index.js                 # Re-exports
├── helpers/
│   ├── testApiClient.js         # API client + assertions
│   ├── freighterMockBuilder.js  # Freighter mock + tracking
│   ├── pollingHelper.js         # Polling logic
│   ├── mockSetup.js             # Backend mocks
│   ├── authHelper.js            # Auth workflows
│   ├── campaignHelper.js        # Campaign workflows
│   └── rewardHelper.js          # Reward workflows
├── pages/
│   ├── MerchantPortalPage.js    # /merchant page object
│   └── CustomerDashboardPage.js # /dashboard page object
├── merchant-reward-flow.spec.js        # Happy path test
├── merchant-reward-errors.spec.js      # Error path tests
├── mobile-overflow.spec.js             # Existing mobile tests
└── reward-issuance.spec.js             # Existing test
```

### Test Execution Flow

```
[Merchant Registers] → [Creates Campaign] → [Issues Reward] → [Polls Balance] → [Verifies Stellar TX]
       (UI)               (UI)                  (UI)          (API Poll)       (TX Hash Validation)
```

### Mock Strategy

**Freighter** (Browser-side via `page.addInitScript()`):
- window.freighterApi = { isConnected, getPublicKey, signTransaction }
- Tracking: window.__freighterMockTracking

**Backend APIs** (Playwright routes via `page.route()`):
- POST /api/trustline/verify → { exists: true }
- POST /api/rewards/distribute → { txHash: 'mock-tx-hash-...' }
- GET /api/users/:wallet/points → { balance: 0 | expectedBalance }

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Fixtures as factory functions** | Fresh data per test, no state pollution |
| **Separate helpers for API & UI** | Test setup speed (API) + coverage (UI) |
| **Page objects for UI** | Resilient selectors, maintainability |
| **test.step() hierarchy** | Visibility, debugging, hierarchical reporting |
| **Mock isolation per error** | Clear error scenarios, no false positives |
| **Exponential backoff polling** | Efficient balance verification (500ms → 4s) |
| **Freighter mock via script injection** | Works in headless Chromium, testable |
| **Separate error spec file** | Cleaner test suite organization |

---

## Reusable Helper Patterns

### Authentication
```javascript
await registerMerchantViaUI(page, { name, walletAddress, businessCategory })
await registerMerchantViaAPI(apiClient, merchantData)
```

### Campaign Management
```javascript
await createCampaignViaUI(page, { name, rewardRate, startDate, endDate })
await createCampaignViaAPI(apiClient, campaignData, apiKey)
```

### Reward Distribution
```javascript
await issueRewardViaUI(page, { campaignName, walletAddress, amount })
await issueRewardViaAPI(apiClient, { walletAddress, amount, campaignId }, apiKey)
```

### Balance Polling
```javascript
await waitForBalanceUpdate(apiClient, walletAddress, expectedAmount)
  // Returns: { balance, attempts, totalTimeMs }
```

### Polling Utilities
```javascript
await pollUntil(predicate, { timeoutMs, initialDelayMs, maxDelayMs })
await pollForElement(page, selector, { timeoutMs })
```

---

## Test Coverage Matrix

### Happy Path Tests (`merchant-reward-flow.spec.js`)
- ✅ Merchant registration
- ✅ Campaign creation
- ✅ Reward issuance
- ✅ Balance polling
- ✅ Stellar TX verification

### Error Path Tests (`merchant-reward-errors.spec.js`)
- ✅ No trustline → distribution blocked
- ✅ Expired campaign → distribution blocked
- ✅ Invalid wallet → validation error
- ✅ Rate limit → 429 response

### Mobile Tests (`mobile-overflow.spec.js`)
- ✅ Form responsive on Pixel 5 (Chromium)
- ✅ Form responsive on iPhone 12 (WebKit)

---

## Pre-Implementation Checklist

### Design Validation
- [ ] Read all 5 design documents
- [ ] Understand test.step() hierarchy
- [ ] Review mock strategy (Freighter + backend)
- [ ] Understand fixture factory pattern
- [ ] Review helper function signatures

### Dependencies
- [ ] @playwright/test ^1.44.0 (already installed)
- [ ] stellar-sdk ^12.3.0 (already installed)
- [ ] No additional dependencies needed

### Environment Setup
- [ ] PostgreSQL running (docker-compose up postgres backend)
- [ ] Backend running on :3001
- [ ] Frontend dev server will start automatically via playwright.config.js

### Pre-Implementation Validation
- [ ] All selectors use accessible queries (getByLabel, getByRole, etc.)
- [ ] All fixtures are deterministic (use RUN_SUFFIX)
- [ ] All helpers accept parameters (no magic values)
- [ ] All mocks are isolated and clearable

---

## Implementation Phases

### Phase 1: Fixtures (Estimated: 30 min)
- Create merchants.js, campaigns.js, rewards.js, users.js
- Create constants.ts
- Export from index.js
- ✅ **Risk: Very Low** (pure functions, no dependencies)

### Phase 2: Utility Helpers (Estimated: 1 hour)
- Extend testApiClient.js with assertions & retry
- Build freighterMockBuilder.js with tracking
- Create pollingHelper.js with exponential backoff
- Create mockSetup.js with error scenarios
- ✅ **Risk: Low** (isolated utilities, well-tested patterns)

### Phase 3: Page Objects (Estimated: 1 hour)
- Create MerchantPortalPage.js with form methods
- Create CustomerDashboardPage.js with wallet methods
- Validate selectors against actual app
- ✅ **Risk: Medium** (selector brittleness, UI changes)

### Phase 4: Business Logic Helpers (Estimated: 45 min)
- Create authHelper.js (register & login)
- Create campaignHelper.js (create campaign)
- Create rewardHelper.js (distribute & poll)
- All using test.step() for organization
- ✅ **Risk: Low** (composition of page objects + API client)

### Phase 5: Test Files (Estimated: 1 hour)
- Create merchant-reward-flow.spec.js (happy path)
- Create merchant-reward-errors.spec.js (error paths)
- Validate mocks work correctly
- Test local execution
- ✅ **Risk: Medium** (mock interaction complexity)

### Phase 6: CI Integration (Estimated: 30 min)
- Add E2E step to .github/workflows/ci.yml
- Set environment variables for CI
- Test in GitHub Actions
- ✅ **Risk: Low** (straightforward CI addition)

**Total Estimated Time: 4.5 hours**

---

## Success Criteria

### Before Implementation Starts
- [ ] All design documents reviewed and approved
- [ ] Team understands test.step() hierarchy
- [ ] Mock strategy validated
- [ ] No questions about architecture

### After Implementation Complete
- [ ] `npx playwright test --project=desktop-chromium` passes locally
- [ ] Tests run in CI with proper reporting
- [ ] Balance polling succeeds within 30s timeout
- [ ] All error scenarios tested separately
- [ ] Mobile layout tests pass
- [ ] Test execution time < 5 minutes per run
- [ ] All helpers are reusable (used in multiple tests)

---

## Future Enhancements (Post-MVP)

1. **Additional E2E Tests**
   - User registration & login flow
   - Wallet connection & trustline setup
   - Point redemption flow
   - Referral bonus tracking

2. **Test Infrastructure**
   - Custom fixtures for performance testing
   - Load testing (bulk reward distribution)
   - Visual regression testing
   - Accessibility testing (ARIA labels, keyboard nav)

3. **CI/CD Enhancements**
   - Parallel test execution across browsers
   - Artifact collection (screenshots, videos)
   - Performance benchmarking
   - Test result history tracking

---

## Questions & Answers

**Q: Why separate helpers for API and UI?**
A: API calls are fast (for setup), UI tests are comprehensive (for coverage). Having both options maximizes test speed while maintaining end-to-end validation.

**Q: Why use test.step() instead of nested describe()?**
A: test.step() provides hierarchical nesting without creating new test scopes. Perfect for organizing a single test with many sub-actions.

**Q: Can I run tests without the mock?**
A: Yes, remove `setupBackendMocks()` and `buildAdvancedFreighterMock()` calls to test against real backend. Requires live PostgreSQL, Redis, and Stellar testnet access.

**Q: How are fixture collisions avoided?**
A: All fixtures include `RUN_SUFFIX = Date.now().toString(36)` which creates unique names per test run. Combined with `fullyParallel: true` and isolated databases per environment.

**Q: Why is balance polling separate from reward issuance?**
A: Separation allows testing the polling timeout separately. Also makes debugging easier when balance updates fail.

---

## References

- Playwright Docs: https://playwright.dev/docs/test-configuration
- Stellar.js Docs: https://developers.stellar.org/docs/learn/building-apps/getting-started
- @stellar/freighter-api: https://www.npmjs.com/package/@stellar/freighter-api
- Nova Rewards Repository: `/workspaces/Nova-Rewards/novaRewards`

---

## Document Versions

| Document | Version | Date | Status |
|----------|---------|------|--------|
| E2E_DESIGN_PART1_FIXTURES.md | 1.0 | 2026-07-16 | ✅ Complete |
| E2E_DESIGN_PART2_HELPERS.md | 1.0 | 2026-07-16 | ✅ Complete |
| E2E_DESIGN_PART3_PAGE_OBJECTS.md | 1.0 | 2026-07-16 | ✅ Complete |
| E2E_DESIGN_PART4_TEST_FLOW.md | 1.0 | 2026-07-16 | ✅ Complete |
| E2E_DESIGN_PART5_SUMMARY.md | 1.0 | 2026-07-16 | ✅ Complete |
| E2E_DESIGN_INDEX.md | 1.0 | 2026-07-16 | ✅ Complete |

---

**Status: Ready for Implementation**

All architecture documents complete. Design approved. No production code written.

Next action: Create files following implementation phases.

