# Referral Contract — Security Threat Analysis

This document analyses the security posture of the `ReferralContract`, with a
focus on the admin-only `claim_referral_reward` privilege and its pool-drain
attack surface. It is referenced from `docs/security/threat-model.md`.

## 1. Scope and trust model

### 1.1 The admin-trust assumption

`ReferralContract::claim_referral_reward` is callable **only by the configured
admin** (`require_auth` on the stored admin address). It is intended to be
invoked after an **off-chain onboarding verification** step: the admin confirms
that a referrer/referee pair genuinely completed onboarding, then submits the
claim on-chain.

There is **no on-chain proof that onboarding actually completed**. The contract
cannot independently verify the off-chain event; it trusts the admin's
attestation. Consequently:

- The integrity of the referral pool depends **entirely on the integrity of the
  admin key**.
- A compromised (or malicious) admin key can submit claims for **fabricated
  addresses** that never onboarded, draining the pool.

This is an accepted design trade-off (off-chain onboarding is out of scope for
redesign), and is mitigated — not eliminated — by the controls described below.

### 1.2 Assets

| Asset | Description |
|-------|-------------|
| Referral pool | Token balance held by the contract, paid out as rewards. |
| Admin key | The single authority able to move pool funds. |
| Reward accounting | Per-address claimed totals and daily aggregate counters. |

### 1.3 Actors

| Actor | Trust |
|-------|-------|
| Admin | Trusted to attest onboarding; highest-value target. |
| Referrer / referee | Untrusted; receive rewards. |
| External attacker | Untrusted; may attempt to compromise admin key. |

## 2. STRIDE analysis of `claim_referral_reward`

### S — Spoofing

**Threat.** An attacker who spoofs the admin identity (stolen/leaked key,
phished signer) can call `claim_referral_reward` and impersonate the legitimate
admin.

**Impact.** Full pool drain via fabricated claims.

**Mitigations.**
- `require_auth` binds the call to the stored admin address; only a holder of
  that key can produce a valid authorization.
- *Operational:* use a multi-sig / smart-wallet admin (see §4) so a single
  stolen key is insufficient.

### T — Tampering

**Threat.** A compromised admin tampers with the reward stream by submitting
claims with attacker-chosen `referrer_amount` / `referee_amount`, or by
replaying claims for the same addresses.

**Impact.** Over-payment, double-payment, pool drain.

**Mitigations (implemented).**
- **Per-claim maximum** (`max_claim_amount`): each individual claim is capped;
  a single call cannot move an unbounded amount.
- **Daily aggregate cap** (`daily_claim_limit`): total payouts within a rolling
  day window are bounded, so even a compromised key cannot drain the pool in a
  single burst.
- **Per-address claim tracking**: an address that has already claimed cannot
  claim again, preventing replay/double-payment.
- Admin-only setters (`set_max_claim_amount`, `set_daily_claim_limit`) let
  operators tighten limits without redeploying.

### R — Repudiation

**Threat.** A malicious admin denies having authorised a drain.

**Mitigations.** Every claim emits an event containing the admin, referrer,
referee, and amounts, providing an on-chain audit trail. *Operational:*
monitor these events (see §4).

### I — Information Disclosure

**Threat.** Low. Claim amounts and addresses are public by design on-chain.

**Mitigations.** None required beyond standard operational key hygiene.

### D — Denial of Service

**Threat.** A compromised admin could exhaust the pool, denying legitimate
future claimants their rewards.

**Mitigations.** The daily aggregate cap bounds the rate of drain, giving
operators time to detect and rotate the key before the pool is emptied.

### E — Elevation of Privilege

**Threat.** The core issue: the admin privilege is **unbounded by on-chain
proof**. A compromised admin key is effectively equivalent to ownership of the
pool — an elevation from "attester" to "custodian".

**Impact.** Complete pool drain with fabricated addresses.

**Mitigations (implemented).**
- Per-claim maximum and daily aggregate cap constrain the blast radius of the
  elevated privilege.
- `InsufficientPool` is checked **before any token transfer** (see §3), so a
  claim that exceeds the available pool fails atomically without partial
  transfers.
- *Operational:* multi-sig admin, monitoring, and key rotation (§4).

## 3. Ordering guarantee: `InsufficientPool` before transfer

`claim_referral_reward` computes the total payout
(`referrer_amount + referee_amount`) and compares it against the contract's
current pool balance **before performing any token transfer**. If
`pool_balance < (referrer_amount + referee_amount)`, the call returns
`Error::InsufficientPool` and **no tokens move**.

This guarantees:

- **Atomicity** — a claim either pays both parties in full or pays nothing;
  there is no partial-transfer state.
- **No silent overdraft** — the pool balance can never go negative via a claim.
- **Fail-fast** — the balance check precedes the transfer, so a failing claim
  cannot consume gas on a doomed transfer or leave accounting inconsistent.

This ordering is verified by an explicit test in
`contracts/referral/tests/referral_tests.rs` that asserts `InsufficientPool`
is returned and that the token balances of the referrer, referee, and contract
are unchanged when the pool is insufficient.

## 4. Recommended operational mitigations

The on-chain caps reduce, but do not remove, the admin-trust risk. Operators
**should** additionally:

1. **Multi-sig admin.** Configure the referral admin as a multi-sig account
   (e.g., via `admin_roles`) so that no single key can authorise a claim.
   Require M-of-N signatures for claims above a threshold.
2. **Monitoring & alerting.** Subscribe to `claim_referral_reward` events and
   alert on anomalous volume, unusual addresses, or claims approaching the
   daily cap.
3. **Key rotation.** Maintain a documented rotation procedure for the admin
   key, and rotate immediately on any suspected compromise.
4. **Conservative limits.** Set `max_claim_amount` and `daily_claim_limit` to
   the minimum values consistent with expected onboarding volume.
5. **Time-locked escalation.** For high-value pools, consider a time-lock on
   large claims so operators can intervene before settlement.

## 5. Residual risk

Even with all mitigations, a compromised admin key can, over time, drain the
pool up to the configured daily limit. The residual risk is therefore
**bounded by the daily aggregate cap and the speed of operator detection**.
Eliminating this risk requires on-chain onboarding proof, which is explicitly
out of scope for this change.
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>