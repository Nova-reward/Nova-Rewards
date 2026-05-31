# ADR 0014: Rust as the Smart Contract Language for Soroban

## Status

Accepted

## Context

Soroban, Stellar's smart contract platform, supports contracts compiled to
WebAssembly (WASM). At the time of adoption, Soroban's official SDK and tooling
had first-class support for Rust. The Nova Rewards platform requires 11
contracts covering token management, reward distribution, vesting, referral,
governance, and admin roles — all of which handle real financial value and
require correctness guarantees.

Considered options:

1. **Rust with `soroban-sdk`** — the officially supported language with the
   most complete SDK, documentation, and community examples. Rust's ownership
   model and type system eliminate entire classes of bugs (use-after-free,
   integer overflow with `overflow-checks = true`, data races).
2. **AssemblyScript** — TypeScript-like syntax compiles to WASM, lower learning
   curve for JavaScript developers, but no official Soroban SDK and limited
   ecosystem support.
3. **C / C++** — compiles to WASM, maximum control, but no memory safety
   guarantees and no Soroban SDK.
4. **Go (TinyGo)** — experimental WASM support, no Soroban SDK.

## Decision

Use Rust with `soroban-sdk` (pinned to `25.3.1`) for all smart contracts in the
`contracts/` workspace:

- All 11 contracts are members of a single Cargo workspace, sharing the
  `soroban-sdk` dependency version and build profile.
- The release profile uses `-Oz` (size optimisation), `lto = true`,
  `codegen-units = 1`, `panic = "abort"`, and `overflow-checks = true` to
  produce small, safe WASM binaries.
- `wasm-opt -Oz --strip-debug` is applied post-build to further reduce binary
  size before deployment.
- Integration tests live in the `integration_tests` workspace member and use
  the Soroban test environment to simulate multi-contract interactions.
- Fuzz targets in the `fuzz/` workspace member use `cargo-fuzz` to test
  contract entry points with arbitrary inputs.

## Consequences

Positive:

- Rust's type system and `overflow-checks = true` eliminate integer overflow
  vulnerabilities common in financial contracts.
- The `soroban-sdk` provides idiomatic abstractions for storage, events,
  cross-contract calls, and the Soroban test environment.
- A single Cargo workspace enforces a consistent SDK version across all
  contracts, preventing version skew.
- Rust's compile-time guarantees reduce the audit surface compared to
  dynamically typed languages.
- `cargo-fuzz` integration enables property-based and fuzz testing of contract
  logic.

Negative:

- Rust has a steep learning curve; contributors unfamiliar with ownership and
  lifetimes face a higher onboarding cost.
- Soroban SDK breaking changes require coordinated upgrades across all workspace
  members.
- WASM binary size must be actively managed; large binaries increase deployment
  cost and ledger storage fees.
- Cross-contract call failures are harder to debug than in-process function
  calls; integration tests are essential.

## Related

- Code: `contracts/Cargo.toml`
- Code: `contracts/nova_token/src/lib.rs`
- Code: `contracts/nova-rewards/src/lib.rs`
- Code: `contracts/integration_tests/`
- Code: `contracts/fuzz/`
- ADR: [0003 — Stellar and Soroban for Reward Settlement](0003-stellar-and-soroban-for-reward-settlement.md)
- ADR: [0005 — Modular Soroban Contracts](0005-modular-soroban-contracts.md)
- Docs: `docs/contracts.md`
