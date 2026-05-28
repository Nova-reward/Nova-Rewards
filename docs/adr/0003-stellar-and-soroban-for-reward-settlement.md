# ADR 0003: Stellar and Soroban for Reward Settlement

## Status

Accepted

## Context

Nova Rewards is a tokenized loyalty platform. Reward transfers must be
verifiable by users and merchants, support wallet custody, and integrate with
Stellar trustlines. The system also needs programmable reward and staking
behavior through contracts.

## Decision

Use Stellar for ledger settlement and Soroban for programmable contract logic:

- `novaRewards/blockchain/sendRewards.js` submits NOVA payment operations through
  Horizon from a distribution account.
- `novaRewards/blockchain/trustline.js` verifies recipient trustlines before
  transfer attempts.
- `novaRewards/backend/services/sorobanService.js` invokes configured Soroban
  campaign contract methods through Soroban RPC.
- Contract events are indexed from Horizon into PostgreSQL for API visibility.

Server-side distribution is used for merchant reward issuance because merchants
authorize the business action through API keys, while the platform-owned
distribution account signs the token payment. User-owned wallet actions remain
user-signed through Freighter.

## Consequences

Positive:

- Users can independently verify NOVA movements on Stellar.
- Trustline checks fail early and give actionable API errors.
- Soroban keeps campaign and reward-program logic auditable and upgradeable.

Negative:

- The backend must protect issuer, distribution, and Soroban signer secrets.
- Stellar network errors and finality delays require retries and clear status
  transitions.
- Contract IDs and network passphrases must be configured per environment.

## Related

- Diagram: [System Design - Contract Interaction Diagram](../system-design.md#contract-interaction-diagram)
- Code: `novaRewards/blockchain/sendRewards.js`
- Code: `novaRewards/blockchain/trustline.js`
- Code: `novaRewards/backend/services/sorobanService.js`
- Code: `novaRewards/backend/services/contractEventService.js`
- Docs: `docs/contracts.md`

