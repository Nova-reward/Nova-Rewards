# Contributing to Nova Rewards

Thank you for your interest in contributing!

## Prerequisites

Before making any changes, please read the following guides:

- **[Stellar & Soroban Integration Tutorial](docs/stellar/integration.md)** — Required reading for any work touching the blockchain layer, transaction submission, or Soroban contracts.

## Getting Started

1. Fork the repository and create a feature branch off `main`.
2. Follow the setup instructions in [README.md](README.md).
3. Make your changes, ensuring no regressions in existing tests.
4. Open a pull request with a clear description referencing the relevant issue.

## Branch Naming

| Type | Pattern |
|------|---------|
| Feature | `feat/<short-description>-<issue>` |
| Bug fix | `fix/<short-description>-<issue>` |
| Documentation | `docs/<short-description>-<issue>` |

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description> #<issue>
```

Examples: `feat: add referral bonus logic #101`, `docs: implement Stellar & Soroban integration tutorial #246`

## Code Standards

- TypeScript for all new frontend/backend code.
- Rust (Soroban SDK) for smart contracts — do not modify `contracts/` without a linked spec.
- No secrets or private keys in source code.
