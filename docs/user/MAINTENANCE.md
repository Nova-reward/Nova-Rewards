# FAQ Maintenance Schedule

## Overview

This document defines the process for keeping `docs/user/faq.md` accurate and up to date as the Nova Rewards platform evolves.

---

## Review Cadence

| Review type | Frequency | Owner |
|-------------|-----------|-------|
| Scheduled full review | Quarterly (Jan, Apr, Jul, Oct) | Product + Support lead |
| Triggered review | On any feature release that affects user-facing flows | Feature owner |
| Hotfix | Within 48 hours of a breaking UX change | On-call support |

---

## Quarterly Review Checklist

Run through this checklist at the start of each quarter:

- [ ] **Staking rate** — confirm the annual rate shown in FAQ #17 matches the current `AnnualRate` stored in the `NovaRewardsContract`.
- [ ] **Drop mechanics** — verify FAQ #11 reflects any changes to Merkle-proof eligibility or claim limits.
- [ ] **Referral bonus amount** — check FAQ #12 against the current `PoolBalance` and credit logic in `ReferralContract`.
- [ ] **KYC thresholds** — confirm FAQ #3 reflects the current identity-verification trigger points.
- [ ] **Redemption catalogue** — ensure FAQ #9 and #10 match the active reward stock and expiry policy.
- [ ] **Wallet setup steps** — re-test the Freighter trustline flow (FAQ #15, #16) against the latest Freighter version.
- [ ] **Swap feature** — verify FAQ #19 reflects the current `min_xlm_out` UX and any path-hop limits.
- [ ] **Support contact details** — confirm the email address in FAQ #25 is still monitored.
- [ ] **Links** — check all internal links (audit docs, referral page, etc.) resolve correctly.
- [ ] Update the "Last reviewed" date at the top of `faq.md`.
- [ ] Open a PR with changes, tag `docs` and `support`, and request review from the Product lead.

---

## Triggered Review Process

When a feature PR is merged that touches any of the following areas, the feature owner must open a follow-up docs PR within **3 business days**:

| Area changed | FAQ sections to review |
|-------------|----------------------|
| Auth / registration flow | Getting Started §1–6 |
| Points / campaign logic | Points & Rewards §7–13 |
| Staking contract | Wallet & Tokens §17–18 |
| Swap / CrossAssetSwap | Wallet & Tokens §19 |
| Trustline / wallet setup | Wallet & Tokens §14–16 |
| Admin / security controls | Wallet & Tokens §20 |
| User profile / settings | Account Settings §21–25 |

---

## Change Log

| Date | Change summary | Author |
|------|---------------|--------|
| 2026-03-30 | Initial FAQ created (25 Q&As, 4 sections) | Nova Rewards Team |
