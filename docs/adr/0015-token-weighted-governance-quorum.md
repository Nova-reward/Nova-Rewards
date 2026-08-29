# ADR 0015: Token-weighted governance quorum

## Status
Accepted

## Context
The governance contract previously used a hard-coded `QUORUM = 1`, so one yes-vote could pass any proposal. Production governance needs quorum to reflect token-holder participation and allow administrators to tune the threshold as the circulating token supply and risk profile change.

## Decision
Governance now stores an admin-configurable `Quorum` at initialization and exposes an admin-only `set_quorum` call for future updates. The selected model is token-weighted voting using the Nova token contract as the source of voting weight:

- `Quorum::Absolute(amount)` requires at least `amount` yes-vote token units.
- `Quorum::Percent(bps)` requires at least `bps / 10_000` of the Nova token total supply, rounded up to avoid under-counting fractional thresholds.

A voter's weight is read from the token contract's `balance(voter)` query when the vote is cast. Percentage quorum is evaluated during finalisation against the token contract's current `total_supply()`.

## Consequences

### Benefits
- Replaces single-voter passage with a participation threshold tied to token weight.
- Supports both simple absolute thresholds and supply-relative thresholds.
- Keeps governance self-contained and avoids snapshot oracle dependencies, which are explicitly out of scope.
- Preserves the existing governance event schema version (`schema_version = 1`) for proposal, vote, finalise, execute, and upgrade events.

### Trade-offs
- Balances are not snapshotted at proposal creation. Token transfers after proposal creation may affect voting weight if holders vote after moving tokens.
- The double-vote guard prevents the same address from voting twice, but it does not prevent token movement between addresses during an active proposal. A full snapshot or delegation system would address this more completely but is intentionally out of scope.
- Percentage quorum is evaluated against current total supply at finalisation, so minting or burning during the voting window can change the required quorum.

## Alternatives considered
- **Minimum voter count:** Easy to reason about, but it ignores token stake and allows many low-stake addresses to dominate quorum.
- **Proposal-time supply snapshots:** Stronger security properties, but requires additional snapshot storage and/or oracle mechanics outside the current scope.
- **Off-chain delegated voting:** Flexible, but explicitly out of scope and more complex to audit.
