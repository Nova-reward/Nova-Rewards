# Nova Rewards — Complete Task Breakdown

---

## Frontend

**Authentication & Onboarding**
- [ ] Add email verification flow after registration
- [ ] Implement forgot password / reset password pages
- [ ] Add OAuth (Google/GitHub) login option
- [ ] Improve onboarding tour with wallet setup steps

**User Dashboard**
- [ ] Build points balance widget with animated counter
- [ ] Add transaction history with pagination and filters
- [ ] Implement real-time balance polling after transactions
- [ ] Add referral link sharing UI with copy-to-clipboard

**Redemption**
- [ ] Add out-of-stock visual indicator on reward cards
- [ ] Show redemption confirmation email preview in modal
- [ ] Add redemption receipt/download after success

**Merchant Dashboard**
- [ ] Build campaign analytics charts (points issued, redemption rate)
- [ ] Add campaign edit/deactivate controls
- [ ] Implement batch reward issuance UI (CSV upload)
- [ ] Add merchant settings page (profile, wallet, notifications)

**Leaderboard & Referrals**
- [ ] Build leaderboard page with top earners and referrers
- [ ] Add referral stats widget on user dashboard

**General**
- [ ] Implement 404 and 500 error pages
- [ ] Add loading skeletons across all data-fetching pages
- [ ] Ensure full keyboard navigation and ARIA compliance
- [ ] Add dark mode persistence across sessions

---

## Backend

**Auth & Users**
- [ ] Implement email verification endpoint
- [ ] Add password reset flow (token generation + email)
- [ ] Add rate limiting to auth endpoints
- [ ] Implement refresh token rotation

**Rewards & Redemptions**
- [ ] Add batch reward distribution endpoint
- [ ] Implement reward expiry logic and cron job
- [ ] Add redemption webhook for merchant notifications
- [ ] Build admin endpoint to create/edit/deactivate rewards

**Campaigns**
- [ ] Add campaign end-date enforcement (auto-deactivate)
- [ ] Implement campaign budget cap enforcement
- [ ] Add campaign analytics aggregation endpoint

**Transactions**
- [ ] Add Stellar transaction hash recording on all reward ops
- [ ] Implement idempotency for reward distribution endpoint
- [ ] Build transaction export endpoint (CSV/JSON)

**Infrastructure**
- [ ] Add request validation middleware (Zod/Joi) to all routes
- [ ] Implement structured logging (Winston/Pino)
- [ ] Add health check endpoint (`/health`)
- [ ] Set up Redis caching for leaderboard and balance queries

---

## Smart Contracts

**NOVA Token (`nova_token`)**
- [ ] Implement mint cap enforcement
- [ ] Add pause/unpause mechanism for emergency stops
- [ ] Validate fixed-point arithmetic edge cases (#205)

**Reward Pool (`reward_pool`)**
- [ ] Implement merchant deposit/withdrawal with balance tracking
- [ ] Add minimum balance enforcement before distribution
- [ ] Write pool drain protection logic

**Admin Roles (`admin_roles`)**
- [ ] Complete two-step admin transfer implementation
- [ ] Add time-lock on sensitive admin operations
- [ ] Emit events for all role changes

**Referral (`referral`)**
- [ ] Finalize duplicate-referrer prevention (#101)
- [ ] Add referral reward cap per user
- [ ] Emit `ReferralRegistered` and `ReferralRewarded` events

**Vesting**
- [ ] Implement cliff + linear vesting schedule
- [ ] Add early withdrawal penalty logic
- [ ] Write vesting cancellation by admin

**Upgrade System**
- [ ] Complete WASM upgrade path with data migration (#206)
- [ ] Add upgrade authorization check (multi-sig required)
- [ ] Write rollback procedure and test it

---

## Testing

**Unit Tests (Backend)**
- [ ] Increase coverage to ≥90% across all routes and services
- [ ] Add property-based tests for reward calculation edge cases
- [ ] Add tests for email service with mocked SMTP

**Smart Contract Tests**
- [ ] Complete `reward_pool` test suite (currently empty `lib.rs`)
- [ ] Add fuzz tests for fixed-point arithmetic
- [ ] Add upgrade/migration round-trip tests

**E2E Tests (Playwright)**
- [ ] Add visual regression snapshots for dashboard and rewards pages
- [ ] Add E2E test for referral link generation and tracking
- [ ] Add E2E test for leaderboard rendering
- [ ] Add E2E test for full wallet connect → redeem → history flow
- [ ] Run E2E suite in CI on every PR

**Load Testing**
- [ ] Write k6 load test for reward distribution endpoint (target: 1,000 req/s)
- [ ] Add load test for redemption endpoint under concurrent users

---

## DevOps

**CI/CD**
- [ ] Add smart contract build + test step to CI pipeline
- [ ] Add E2E Playwright run to CI (against preview deployment)
- [ ] Add code coverage gate (fail PR if coverage drops below threshold)
- [ ] Set up Dependabot for dependency updates

**Infrastructure**
- [ ] Provision PostgreSQL with read replica for analytics queries
- [ ] Set up Redis cluster for session and cache
- [ ] Configure auto-scaling for backend (ASG min/max)
- [ ] Add CloudWatch alarms for error rate, latency, and CPU

**Deployment**
- [ ] Automate Soroban contract deployment via CI script
- [ ] Add Mainnet deployment checklist enforcement in CI
- [ ] Set up staging environment mirroring production
- [ ] Implement blue/green deployment for zero-downtime releases

**Security**
- [ ] Enable WAF rules on ALB
- [ ] Rotate all secrets and store in AWS Secrets Manager
- [ ] Add SAST scan (Semgrep/CodeQL) to CI pipeline
- [ ] Schedule quarterly dependency vulnerability audits

---

## Documentation

- [ ] Write user guide: wallet setup, earning, and redeeming rewards
- [ ] Write merchant handbook: registration, campaigns, reward issuance
- [ ] Complete API reference (OpenAPI spec → Swagger UI)
- [ ] Write smart contract integration guide for external developers
- [ ] Add architecture diagram (system components + data flow)
- [ ] Document key rotation and admin transfer procedures
- [ ] Publish security audit report once complete
- [ ] Write runbook for on-call: incident response, rollback steps

---

## UI/UX Design

- [ ] Design and deliver high-fidelity mockups for all dashboard pages
- [ ] Create component library / design system (colors, typography, spacing tokens)
- [ ] Design empty states for all data-fetching views
- [ ] Design mobile-first reward card and redemption modal
- [ ] Create onboarding illustrations for wallet setup steps
- [ ] Design merchant analytics charts and data visualizations
- [ ] Conduct usability testing with 5+ real users before Beta
- [ ] Deliver accessibility audit and remediation plan (WCAG 2.1 AA)
