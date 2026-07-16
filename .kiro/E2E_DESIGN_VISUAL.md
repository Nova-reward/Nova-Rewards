# E2E Test Suite Design - Visual Architecture

## Complete Test Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        E2E TEST ARCHITECTURE DIAGRAM                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                    [TEST FILES]
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
        ┌───────▼─────────┐   ┌────────▼───────┐   ┌──────────▼──────┐
        │ merchant-reward │   │ merchant-reward│   │    mobile-      │
        │    -flow.spec   │   │   -errors.spec │   │  overflow.spec  │
        │                 │   │                │   │                 │
        │ Happy Path:     │   │ Error Paths:   │   │ Mobile Layout   │
        │ • Register      │   │ • No trustline │   │ • Responsive    │
        │ • Campaign      │   │ • Expired      │   │ • Overflow      │
        │ • Reward        │   │ • Rate limit   │   │ • Touch input   │
        │ • Balance Poll  │   │ • Invalid addr │   │                 │
        └───┬─────────────┘   └────┬───────────┘   └────────┬────────┘
            │                      │                        │
            └──────────────────────┼────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼──────────┐      ┌──────────▼────────┐
            │  PAGE OBJECTS    │      │  BUSINESS LOGIC   │
            │                  │      │  HELPERS          │
            ├──────────────────┤      ├───────────────────┤
            │MerchantPortal    │      │authHelper         │
            │ • fillRegister() │      │ • registerMV()    │
            │ • submitReg()    │      │ • loginUI()       │
            │ • waitApiKey()   │      │ • isMerchant()    │
            │                  │      │                   │
            │ • fillCampaign() │      │campaignHelper     │
            │ • submitCmpg()   │      │ • createCmpgViaUI │
            │ • fillReward()   │      │ • createCmpgViaAPI│
            │ • submitReward() │      │                   │
            │ • getErrorMsg()  │      │rewardHelper       │
            │                  │      │ • issueReward()   │
            │CustomerDashboard │      │ • pollBalance()   │
            │ • connectWallet()│      │ • waitForUpdate() │
            │ • getBalance()   │      │                   │
            │ • setupTrustline│      └───────────────────┘
            └────────┬─────────┘              │
                     │                        │
                     └────────────┬───────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   UTILITY HELPERS          │
                    ├────────────────────────────┤
                    │ testApiClient              │
                    │ • retry logic              │
                    │ • error assertions         │
                    │ • logging                  │
                    │                            │
                    │ freighterMockBuilder       │
                    │ • delays                   │
                    │ • tracking                 │
                    │ • sign request log         │
                    │                            │
                    │ pollingHelper              │
                    │ • exponential backoff      │
                    │ • timeout handling         │
                    │ • retry logic              │
                    │                            │
                    │ mockSetup                  │
                    │ • trustline mock           │
                    │ • distribute mock          │
                    │ • balance mock             │
                    │ • error mocks              │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │    FIXTURES               │
                    ├────────────────────────────┤
                    │ merchants.js               │
                    │ • valid()                  │
                    │ • invalid variants         │
                    │                            │
                    │ campaigns.js               │
                    │ • valid()                  │
                    │ • expired()                │
                    │ • invalidDates()           │
                    │                            │
                    │ rewards.js                 │
                    │ • standard()               │
                    │ • noTrustline()            │
                    │ • invalidAmount()          │
                    │                            │
                    │ users.js                   │
                    │ • valid()                  │
                    │ • weakPassword()           │
                    │                            │
                    │ constants.ts               │
                    │ • TEST_CONFIG              │
                    │ • STELLAR_WALLETS          │
                    │ • TIMEOUTS                 │
                    └────────────────────────────┘
```

---

## Test Execution Flow with test.step() Hierarchy

```
MERCHANT REWARD FLOW TEST
│
├─ [1] Install Mocks
│  ├─ [1.1] Freighter mock (browser-side)
│  │  └─ window.freighterApi = { isConnected, getPublicKey, signTransaction }
│  │
│  └─ [1.2] Backend mocks (Playwright routes)
│     ├─ POST /api/trustline/verify → { exists: true }
│     ├─ POST /api/trustline/build → { xdr: '...' }
│     ├─ POST /api/rewards/distribute → { txHash: 'mock-...' }
│     └─ GET /api/users/:wallet/points → { balance: 0 | expected }
│
├─ [2] Merchant Registration
│  ├─ [2.1] Navigate to /merchant
│  ├─ [2.2] Fill form (name, wallet, category)
│  ├─ [2.3] Submit form
│  └─ [2.4] Capture API key from UI
│
├─ [3] Authentication Verification
│  └─ [3.1] Verify registration form NOT visible
│
├─ [4] Campaign Creation
│  ├─ [4.1] Fill form (name, rate, dates)
│  ├─ [4.2] Submit form
│  └─ [4.3] Wait for success message
│
├─ [5] Campaign Visibility
│  └─ [5.1] Assert campaign in table
│
├─ [6] Reward Distribution
│  ├─ [6.1] Select campaign dropdown
│  ├─ [6.2] Fill wallet address & amount
│  ├─ [6.3] Submit form
│  └─ [6.4] Capture TX hash from success
│
├─ [7] Transaction Link Verification
│  └─ [7.1] Assert link → stellar.expert/testnet/txHash
│
├─ [8] Balance Polling
│  ├─ [8.1] GET /api/users/:wallet/points
│  ├─ [8.2] Wait for balance >= expected
│  ├─ [8.3] Exponential backoff (500ms → 4s)
│  └─ [8.4] Assert timeout < 30s
│
├─ [9] Freighter Verification
│  └─ [9.1] Check __freighterMockTracking.signRequests.length > 0
│
├─ [10] Stellar Testnet Format
│  └─ [10.1] Assert txHash matches mock-tx-hash-* pattern
│
└─ [11] Summary
   └─ [11.1] Log: Merchant, Campaign, Reward, Balance
```

---

## Mock Interaction Sequence Diagram

```
┌─────────┐         ┌──────────┐         ┌────────┐         ┌─────────────┐
│ Browser │         │ Backend  │         │Stellar │         │ PostgreSQL  │
│         │         │   API    │         │ Mock   │         │             │
└────┬────┘         └────┬─────┘         └───┬────┘         └─────┬───────┘
     │                   │                    │                   │
     │  1. POST /merchants/register            │                   │
     ├──────────────────────────────────────►  │                   │
     │                   │                    │  2. INSERT merchant│
     │                   ├───────────────────────────────────────► │
     │                   │                    │                   │
     │  3. Response + API key                  │                   │
     │ ◄──────────────────────────────────────┤                   │
     │                   │                    │                   │
     │  4. POST /campaigns (x-api-key)         │                   │
     ├──────────────────────────────────────►  │                   │
     │                   │                    │  5. INSERT campaign│
     │                   ├───────────────────────────────────────► │
     │                   │                    │                   │
     │  6. Response + campaign ID              │                   │
     │ ◄──────────────────────────────────────┤                   │
     │                   │                    │                   │
     │  7. POST /rewards/distribute            │                   │
     ├──────────────────────────────────────►  │                   │
     │                   │  8. Mock Response  │                   │
     │                   │  { txHash: '...' } │                   │
     │ 9. Success + txHash                     │                   │
     │ ◄──────────────────────────────────────┤                   │
     │                   │                    │                   │
     │  10. GET /api/users/:wallet/points      │                   │
     ├──────────────────────────────────────►  │                   │
     │                   │  11. Mock: balance │                   │
     │ 12. Poll loop with backoff              │ (increments after  │
     │     until balance >= expected           │  distribute call)  │
     │                   │                    │                   │
     │  13. Balance == Expected ✓              │                   │
     │ ◄──────────────────────────────────────┤                   │
     │                   │                    │                   │
```

---

## Helper Dependency Graph

```
                            ┌──────────────┐
                            │ Test File    │
                            │ .spec.js     │
                            └────────┬─────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
      ┌─────▼────┐          ┌────────▼────────┐       ┌──────▼──────┐
      │ authHelper│          │ campaignHelper  │       │ rewardHelper│
      │           │          │                 │       │             │
      │ ├─ UI     │          │ ├─ UI           │       │ ├─ UI       │
      │ └─ API    │          │ └─ API          │       │ └─ API      │
      └─────┬─────┘          └────────┬────────┘       └──────┬──────┘
            │                         │                       │
            └────────────┬────────────┴──────────────┬────────┘
                         │                          │
                    ┌────▼──────────┐         ┌─────▼──────────┐
                    │ Page Objects  │         │ Utility Helpers│
                    │               │         │                │
                    │ MerchantPortal│         │ testApiClient  │
                    │ Dashboard     │         │ pollingHelper  │
                    │               │         │ freighterMock  │
                    │ (Selectors)   │         │ mockSetup      │
                    └────┬──────────┘         └─────┬──────────┘
                         │                         │
                         └────────────┬────────────┘
                                      │
                           ┌──────────▼───────────┐
                           │ Fixtures (Data)     │
                           │                     │
                           │ merchants.js        │
                           │ campaigns.js        │
                           │ rewards.js          │
                           │ users.js            │
                           │ constants.ts        │
                           └─────────────────────┘
```

---

## Mock Configuration State Machine

```
BEFORE TEST
│
├─ Mock State: RESET
│  ├─ Freighter: Not installed
│  ├─ Backend routes: No intercepts
│  └─ Page: No navigation
│
SETUP PHASE
│
├─ [addInitScript] → Freighter Mock Installed
│  └─ window.freighterApi available
│
├─ [page.route] → Backend Mocks Installed
│  ├─ /api/trustline/verify → { exists: true }
│  ├─ /api/rewards/distribute → { txHash: 'mock-...' }
│  └─ /api/users/:wallet/points → { balance: 0 }
│
EXECUTION PHASE
│
├─ [POST /merchants/register]
│  └─ Real backend called (no mock)
│
├─ [POST /campaigns]
│  └─ Real backend called (no mock)
│
├─ [POST /rewards/distribute]
│  └─ Mocked: Returns { txHash: 'mock-...' }
│  └─ Side effect: distributed = true
│
├─ [GET /api/users/:wallet/points]
│  └─ Mocked: Returns { balance: 0 | expectedBalance }
│  └─ If distributed: returns expectedBalance
│  └─ Otherwise: returns 0
│
TEARDOWN PHASE
│
├─ Page.close()
│  └─ All mocks cleared
│  └─ Freighter context destroyed
│
└─ Test file cleanup
   └─ Test data persists in DB (for next test)
```

---

## Error Path Testing Structure

```
merchant-reward-errors.spec.js

├─ test.beforeEach()
│  └─ Install Freighter mock for each test
│
├─ Scenario 1: No Trustline
│  ├─ setupMockNoTrustline(page)
│  │  └─ /api/trustline/verify → { exists: false }
│  ├─ registerMerchant + createCampaign
│  ├─ Attempt distribution
│  └─ Assert error: "trustline"
│
├─ Scenario 2: Expired Campaign
│  ├─ setupMockExpiredCampaign(page)
│  │  └─ /api/rewards/distribute → 400, "Campaign is expired"
│  ├─ registerMerchant + createCampaign (expired)
│  ├─ Attempt distribution
│  └─ Assert error: "expired"
│
├─ Scenario 3: Invalid Wallet
│  ├─ registerMerchant + createCampaign
│  ├─ Fill form with invalid wallet
│  ├─ Attempt submission
│  └─ Assert UI validation error: "wallet"
│
└─ Scenario 4: Rate Limit
   ├─ setupMockRateLimit(page)
   │  └─ /api/rewards/distribute → 429, "Too many requests"
   ├─ registerMerchant + createCampaign
   ├─ Attempt distribution
   └─ Assert error: "rate limit"
```

---

## Polling Strategy: Exponential Backoff

```
waitForBalanceUpdate(apiClient, wallet, expectedAmount)
│
├─ Initial state: balance = 0, attempts = 0
│
├─ Attempt 1 (delay = 500ms)
│  ├─ GET /api/users/:wallet/points
│  └─ balance = 0 → retry (not ready yet)
│
├─ Wait 500ms
│
├─ Attempt 2 (delay = 1000ms)
│  ├─ GET /api/users/:wallet/points
│  └─ balance = 0 → retry
│
├─ Wait 1000ms
│
├─ Attempt 3 (delay = 2000ms)
│  ├─ GET /api/users/:wallet/points
│  └─ balance = 0 → retry
│
├─ Wait 2000ms
│
├─ Attempt 4 (delay = 4000ms)
│  ├─ GET /api/users/:wallet/points
│  └─ balance = 10.0000000 ✓ SUCCESS
│
└─ Return { balance: 10, attempts: 4, totalTimeMs: 7500ms }

TIMEOUT SCENARIO
│
├─ Deadline: 30,000ms from start
│
├─ Attempt N (delay = 4000ms)
│  ├─ Date.now() > deadline
│  └─ Throw Error: "Timed out after N attempts"
│
└─ Test fails (data not updated in time)
```

---

## File Dependencies Tree

```
merchant-reward-flow.spec.js
│
├─ [Import] createTestApiClient
│  └─ helpers/testApiClient.js
│     └─ [uses] helpers/apiClient.js (existing)
│
├─ [Import] buildAdvancedFreighterMock
│  └─ helpers/freighterMockBuilder.js
│     └─ [uses] helpers/freighterMock.js (existing)
│
├─ [Import] setupBackendMocks
│  └─ helpers/mockSetup.js
│     └─ [uses] page.route() (Playwright)
│
├─ [Import] registerMerchantViaUI
│  └─ helpers/authHelper.js
│     └─ [uses] MerchantPortalPage
│        └─ pages/MerchantPortalPage.js
│
├─ [Import] createCampaignViaUI
│  └─ helpers/campaignHelper.js
│     └─ [uses] MerchantPortalPage
│
├─ [Import] issueRewardViaUI
│  └─ helpers/rewardHelper.js
│     └─ [uses] MerchantPortalPage
│
├─ [Import] waitForBalanceUpdate
│  └─ helpers/rewardHelper.js
│     └─ [uses] helpers/pollingHelper.js
│
├─ [Import] MERCHANTS, CAMPAIGNS, REWARDS, STELLAR_WALLETS
│  └─ fixtures/index.js
│     ├─ fixtures/merchants.js
│     ├─ fixtures/campaigns.js
│     ├─ fixtures/rewards.js
│     └─ fixtures/constants.ts
│
└─ [Import] TEST_CONFIG
   └─ fixtures/constants.ts
```

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Test Files to Create | 2 |
| Page Objects | 2 |
| Helper Utilities | 7 |
| Business Logic Helpers | 3 |
| Fixture Files | 5 |
| Total New Files | 19 |
| Lines of Code (Est.) | 2,000 |
| Test Scenarios | 9 (1 happy path + 4 error paths + mobile) |
| Reusable Functions | 30+ |
| Mock Configurations | 5 |
| Timeouts Configured | 6 |

---

**Status: Architecture Complete ✓**

Ready for implementation in order:
1. Fixtures (Part 1)
2. Utilities (Part 2)
3. Page Objects (Part 3)
4. Test Files (Part 4)
5. CI Integration (Part 5)

