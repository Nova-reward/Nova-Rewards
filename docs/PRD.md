# Nova Rewards — Product Requirements Document

**Version:** 1.0  
**Last Updated:** March 28, 2026  
**Status:** Draft — Pending Sign-off

---

## Product Vision

Nova Rewards transforms traditional loyalty programs into a transparent, interoperable, blockchain-powered rewards ecosystem. By tokenizing loyalty points on the Stellar network, we give users true ownership of their rewards while enabling businesses to create engaging, cross-merchant loyalty experiences with minimal friction and maximum trust.

---

## Target Users

### Primary Users

1. **Merchants & Businesses**
   - Small to medium-sized businesses seeking modern loyalty solutions
   - E-commerce platforms wanting to differentiate through blockchain rewards
   - Multi-location retailers needing unified loyalty infrastructure
   - Web3-native brands targeting crypto-savvy customers

2. **End Customers**
   - Crypto-curious consumers exploring blockchain utility
   - Loyalty program participants frustrated with traditional point systems
   - Users seeking transferable, redeemable digital assets
   - Early adopters interested in DeFi and tokenized rewards

### Secondary Users

3. **Platform Administrators**
   - System operators managing contract deployments and upgrades
   - Support teams handling merchant onboarding and troubleshooting

---

## Problem Statement

Traditional loyalty programs suffer from:

- **Fragmentation:** Points locked within single merchant ecosystems with no portability
- **Opacity:** Hidden expiration rules, arbitrary devaluations, unclear redemption terms
- **Limited Value:** Restricted redemption options, poor liquidity, no peer-to-peer transfer
- **High Friction:** Complex enrollment, delayed point crediting, cumbersome redemption flows
- **Trust Deficit:** Centralized control enables unilateral program changes without user consent

Nova Rewards solves these problems by leveraging blockchain transparency, smart contract automation, and Stellar's fast, low-cost infrastructure to create a loyalty ecosystem where rewards are truly owned, freely transferable, and verifiably fair.

---

## Goals & Success Metrics

### Business Goals

1. **Merchant Adoption:** Onboard 50+ merchants by Public Launch
2. **User Engagement:** Achieve 10,000+ registered wallets within 6 months of launch
3. **Transaction Volume:** Process 100,000+ reward transactions in Year 1
4. **Platform Sustainability:** Establish revenue model through merchant fees or premium features

### Key Performance Indicators (KPIs)

| Metric | Target (3 months post-launch) | Target (6 months post-launch) |
|--------|-------------------------------|-------------------------------|
| **Daily Active Users (DAU)** | 500 | 2,000 |
| **Points Issued per Day** | 50,000 NOVA | 200,000 NOVA |
| **Redemption Rate** | 15% | 25% |
| **Referral Conversion Rate** | 10% | 20% |
| **Staking Participation Rate** | N/A (V2 feature) | 30% of active users |
| **Average Transaction Time** | <5 seconds | <5 seconds |
| **Merchant Retention (90-day)** | 70% | 80% |

---

## Feature List

### Core Features (Must Have)

#### 1. Blockchain Infrastructure
- **NOVA Token Contract** — Stellar-based asset issuance with mint/burn/transfer capabilities
- **Reward Pool Contract** — Secure deposit/withdrawal mechanism for merchant reward funding
- **Admin Roles Contract** — Multi-signature admin management with two-step transfer
- **Contract Upgrade System** — Safe WASM upgrade path with data migration support

**Related Issues:** #206 (upgrade), #205 (precision)

#### 2. Reward Distribution
- **Merchant Dashboard** — Campaign creation, reward issuance, transaction history
- **Automated Reward Crediting** — Backend API for programmatic point distribution
- **Batch Reward Processing** — Efficient multi-recipient reward distribution
- **Reward Rate Configuration** — Flexible percentage-based reward calculations with 6-decimal precision

**Related Issues:** #205 (fixed-point arithmetic)

#### 3. User Wallet Integration
- **Freighter Wallet Connect** — Browser extension integration for transaction signing
- **Trustline Management** — Automated trustline creation for NOVA asset
- **Balance Display** — Real-time NOVA balance and transaction history
- **Peer-to-Peer Transfer** — User-to-user NOVA token transfers

#### 4. Referral System
- **Referral Registration** — One-time referrer assignment per wallet
- **Referral Tracking** — Counter-based leaderboard for top referrers
- **Referral Rewards** — Automated bonus crediting for successful referrals
- **Duplicate Prevention** — Enforcement of single-referrer-per-user rule

**Related Issues:** #101 (referral logic)

#### 5. Redemption System
- **Merchant Redemption Interface** — Point-for-product/service exchange
- **Redemption History** — Audit trail of all redemption transactions
- **Multi-Merchant Redemption** — Cross-merchant point acceptance

### Enhanced Features (Should Have)

#### 6. Cross-Asset Swaps
- **DEX Integration** — Multi-hop swap routing for NOVA → XLM conversion
- **Slippage Protection** — Minimum output guarantees for swap transactions
- **Swap Path Optimization** — Up to 5-hop routing for best exchange rates

**Related Issues:** #200 (swap implementation)

#### 7. Vesting & Time-Locked Rewards
- **Vesting Schedule Creation** — Cliff and linear vesting configurations
- **Automated Release** — Time-based token unlock mechanism
- **Beneficiary Management** — Multi-schedule support per user

#### 8. Analytics & Reporting
- **Merchant Analytics Dashboard** — Campaign performance, ROI metrics
- **User Activity Insights** — Engagement patterns, redemption behavior
- **Leaderboard System** — Top earners, top referrers, most active merchants

#### 9. Email Notifications
- **Reward Alerts** — Email confirmation of points earned
- **Redemption Confirmations** — Transaction receipts
- **Campaign Announcements** — Merchant promotional communications

### Future Features (Could Have)

#### 10. Staking & Yield
- **NOVA Staking Pools** — Lock tokens for yield generation
- **Tiered Rewards** — Bonus multipliers for staked balances
- **Governance Participation** — Voting rights for stakers (V2)

#### 11. NFT Integration
- **Achievement Badges** — Non-fungible rewards for milestones
- **Exclusive Access Tokens** — NFT-gated merchant perks
- **Collectible Campaigns** — Limited-edition digital collectibles

#### 12. Mobile Application
- **Native iOS/Android Apps** — Mobile-first user experience
- **Push Notifications** — Real-time reward alerts
- **QR Code Redemption** — In-store point-of-sale integration

---

## Feature Priority Matrix

| Priority | Feature | GitHub Issues | Milestone |
|----------|---------|---------------|-----------|
| **Must Have** | NOVA Token Contract | — | Alpha |
| **Must Have** | Reward Pool Contract | — | Alpha |
| **Must Have** | Admin Roles Contract | — | Alpha |
| **Must Have** | Referral System | #101 | Alpha |
| **Must Have** | Fixed-Point Arithmetic | #205 | Alpha |
| **Must Have** | Contract Upgrade System | #206 | Alpha |
| **Must Have** | Merchant Dashboard | — | Beta |
| **Must Have** | User Wallet Integration | — | Beta |
| **Must Have** | Reward Distribution API | — | Beta |
| **Must Have** | Redemption System | — | Beta |
| **Must Have** | Stellar Integration | #246 | Beta |
| **Should Have** | Cross-Asset Swaps | #200 | Public Launch |
| **Should Have** | Vesting Contracts | — | Public Launch |
| **Should Have** | Analytics Dashboard | — | Public Launch |
| **Should Have** | Email Notifications | — | Public Launch |
| **Should Have** | Leaderboard System | — | Public Launch |
| **Could Have** | Staking Pools | — | V2 |
| **Could Have** | NFT Integration | — | V2 |
| **Could Have** | Mobile Apps | — | V2 |
| **Won't Have** | Fiat On-Ramp (use 3rd party) | — | — |
| **Won't Have** | Built-in KYC (use 3rd party) | — | — |

---

## Milestone Schedule

| Milestone | Target Date | Required Issues | Success Criteria |
|-----------|-------------|-----------------|------------------|
| **Alpha (Internal)** | Q2 2026 | #101, #205, #206 | All smart contracts deployed to Testnet; basic reward issuance functional; internal team testing complete |
| **Beta (Closed)** | Q3 2026 | #200, #246 | 10 pilot merchants onboarded; 500 beta users; swap functionality live; feedback collection system operational |
| **Public Launch** | Q4 2026 | All Must Have + Should Have | 50+ merchants; 5,000+ users; full feature set live on Mainnet; documentation complete; support infrastructure ready |
| **V2 (Enhanced)** | Q2 2027 | Staking, NFTs, Mobile | Staking pools live; NFT rewards integrated; mobile apps in app stores; 20,000+ users |

---

## Out of Scope

The following features are explicitly excluded from the current roadmap:

1. **Fiat Payment Processing** — Merchants handle fiat transactions independently; Nova Rewards focuses on reward layer only
2. **Built-in KYC/AML** — Compliance delegated to wallet providers and merchant systems
3. **Custodial Wallets** — Users must bring their own Stellar wallets (non-custodial model)
4. **Multi-Chain Support** — Stellar-only for V1; other chains considered for V2+
5. **Merchant Payment Gateway** — Not a POS system; integrates with existing payment infrastructure
6. **Customer Support Chat** — Email/ticket-based support only; no live chat in V1
7. **Automated Market Making** — DEX liquidity provision handled by external protocols
8. **Credit/Lending Features** — No borrowing against NOVA balances in V1

---

## Risks & Mitigations

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Smart Contract Vulnerabilities** | Critical | Medium | Comprehensive test coverage; external audit before Mainnet; bug bounty program |
| **Stellar Network Congestion** | High | Low | Monitor network health; implement retry logic; maintain XLM reserves for fees |
| **WASM Size Limits** | Medium | Medium | Storage schema optimization (#205); modular contract architecture; regular size audits |
| **Upgrade Migration Failures** | High | Low | Extensive upgrade testing (#206); rollback procedures; staged rollout |
| **DEX Liquidity Issues** | Medium | Medium | Partner with liquidity providers; set realistic slippage tolerances; educate users |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low Merchant Adoption** | Critical | Medium | Pilot program with incentives; clear ROI documentation; white-glove onboarding |
| **Regulatory Uncertainty** | High | Medium | Legal counsel review; terms of service clarity; geographic restrictions if needed |
| **User Wallet Friction** | High | High | Detailed onboarding guides; video tutorials; Freighter partnership for UX improvements |
| **Token Value Volatility** | Medium | High | Merchant-funded pools; no speculative trading emphasis; utility-focused messaging |
| **Competitor Launch** | Medium | Medium | Rapid iteration; community building; unique Stellar advantages (speed, cost) |

### Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Key Management Failures** | Critical | Low | Hardware security modules; multi-sig admin controls; documented key rotation procedures |
| **Backend Downtime** | High | Low | Redundant infrastructure; monitoring/alerting; 99.9% uptime SLA |
| **Support Overload** | Medium | High | Comprehensive FAQ; community forums; tiered support system; chatbot for common issues |
| **Data Loss** | High | Low | Automated backups; blockchain immutability for critical data; disaster recovery plan |

---

## Technical Architecture Summary

### Smart Contracts (Soroban/Rust)
- `nova_token` — ERC-20-style token with mint/burn
- `reward_pool` — Merchant deposit/withdrawal management
- `admin_roles` — Multi-sig admin with two-step transfer
- `vesting` — Time-locked token release
- `referral` — Referral tracking and reward crediting
- `nova-rewards` — Core rewards logic with swap integration

### Backend (Node.js/Express)
- RESTful API for merchant/user operations
- PostgreSQL database for off-chain data
- Stellar SDK integration for transaction submission
- JWT authentication for merchant dashboards

### Frontend (Next.js/React)
- Merchant dashboard (campaign management, analytics)
- User dashboard (balance, history, redemption)
- Freighter wallet integration
- Responsive design for mobile/desktop

### Infrastructure
- Stellar Testnet (Alpha/Beta)
- Stellar Mainnet (Public Launch)
- Horizon API for blockchain queries
- AWS/Vercel hosting (TBD)

---

## Success Criteria for Launch

### Alpha Readiness
- [ ] All 6 smart contracts deployed and tested on Testnet
- [ ] Fixed-point arithmetic validated (#205)
- [ ] Upgrade mechanism tested (#206)
- [ ] Referral system functional (#101)
- [ ] Internal team can issue/redeem rewards end-to-end

### Beta Readiness
- [ ] Merchant onboarding flow complete
- [ ] User wallet connection working (Freighter)
- [ ] Stellar integration guide published (#246)
- [ ] 10 pilot merchants signed up
- [ ] 500 beta users registered
- [ ] Feedback collection system operational

### Public Launch Readiness
- [ ] All Must Have + Should Have features live
- [ ] Smart contract audit complete (external firm)
- [ ] Mainnet deployment successful
- [ ] Documentation complete (user guides, API docs, merchant handbook)
- [ ] Support infrastructure ready (ticketing system, FAQ, tutorials)
- [ ] 50+ merchants onboarded
- [ ] Marketing campaign launched
- [ ] Legal terms of service finalized

---

## Sign-off

This PRD requires approval from the project lead and at least two contributors before implementation begins.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Project Lead** | _[Pending]_ | _[Pending]_ | _[Pending]_ |
| **Contributor 1** | _[Pending]_ | _[Pending]_ | _[Pending]_ |
| **Contributor 2** | _[Pending]_ | _[Pending]_ | _[Pending]_ |

---

## Appendix

### Related Documentation
- [Contract Events Schema](./contract-events.md)
- [Storage Optimization Guide](./storage-schema.md)
- [Stellar Integration Tutorial](./stellar/integration.md)
- [Contract Upgrade Guide](./upgrade-guide.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

### Revision History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-28 | AI Assistant | Initial PRD creation |

---

**Document Status:** Draft — Awaiting review and sign-off from project stakeholders.
