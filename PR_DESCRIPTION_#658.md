# feat(web3): XDR Encoding/Decoding Utilities with Type-Safe Contract Wrappers

Closes #658

## Summary

Implements utility functions for encoding and decoding Stellar XDR contract arguments and return values, plus type-safe wrappers generated from Soroban contract bindings.

## Changes

| File | Description |
|---|---|
| `novaRewards/backend/lib/xdr-codec.ts` | Core codec — `encodeContractArgs`, `decodeContractResult`, `decodeContractEvent`, address helpers |
| `novaRewards/backend/lib/contract-wrappers.ts` | Type-safe wrappers for `nova-rewards`, `nova_token`, `reward_pool`, `campaign` contracts |
| `novaRewards/backend/tests/xdr-codec.test.js` | 25 unit tests covering all encode/decode round-trips |

## Acceptance Criteria

- [x] `encodeContractArgs(functionName, args)` encodes arguments to XDR ScVal
- [x] `decodeContractResult(xdr)` decodes XDR ScVal to TypeScript types
- [x] `decodeContractEvent(event)` parses Horizon event XDR to typed objects
- [x] Type-safe wrappers generated from Soroban contract TypeScript bindings (`contract-wrappers.ts`)
- [x] Unit tests cover encoding/decoding round-trips for all contract function signatures
