# ADR 0005: Modular Soroban Contracts with Explicit Cross-Contract Calls

## Status

Accepted

## Context

The contract workspace contains token, reward pool, distribution, staking,
campaign, referral, vesting, governance, admin roles, redemption, escrow, and
state-management logic. Combining everything into one contract would simplify
deployment but increase blast radius and make audits harder.

## Decision

Keep Soroban contracts modular and make cross-contract calls explicit:

- `nova_token` owns fungible token balances and allowances.
- `reward_pool` calls `nova_token` for pool deposits, balance checks, and
  withdrawals.
- `distribution` calls `nova_token` for distribution and clawback transfers.
- `nova-rewards` owns staking, account recovery, upgrade hooks, and configured
  DEX-router swaps.
- `campaign`, `redemption`, `referral`, `vesting`, `admin_roles`,
  `governance`, `escrow`, and `contract_state` keep their own bounded state and
  emit events or perform internal accounting unless source code shows an
  explicit external call.

The contract interaction diagram must show both actual calls and intentional
standalone boundaries so reviewers can separate deployed dependencies from
future extension points.

## Consequences

Positive:

- Each contract has a smaller audit surface and clearer storage ownership.
- Token movement dependencies are visible in source and diagrams.
- Individual contracts can be upgraded, tested, and deployed independently.

Negative:

- Deployment and initialization order matters when a contract stores another
  contract address.
- Cross-contract calls add failure modes and must be covered by integration
  tests.
- Documentation must distinguish actual calls from comments or planned
  interactions.

## Related

- Diagram: [System Design - Contract Interaction Diagram](../system-design.md#contract-interaction-diagram)
- Code: `contracts/Cargo.toml`
- Code: `contracts/nova_token/src/lib.rs`
- Code: `contracts/reward_pool/src/lib.rs`
- Code: `contracts/distribution/src/lib.rs`
- Code: `contracts/nova-rewards/src/lib.rs`

