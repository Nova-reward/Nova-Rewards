# Contributing to Nova Rewards

Welcome, and thank you for taking the time to contribute! 🎉  
This guide covers everything you need to get started — from setting up your environment to submitting a polished pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Style](#commit-style)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Code Style Guide](#code-style-guide)
- [Required Reading](#required-reading)

---

## Code of Conduct

By participating in this project, you agree to uphold a respectful and inclusive environment. Be kind, constructive, and collaborative.

---

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Create a branch from `main` following the [branch naming conventions](#branch-naming-conventions) below.
3. Follow the setup instructions in [README.md](README.md).
4. Make your changes — no regressions in existing tests.
5. Open a pull request referencing the relevant issue.

### Prerequisites

- Node.js ≥ 18
- Stellar CLI / SDK
- Rust + Soroban SDK (for contract work)
- A Freighter wallet (for local testing)

---

## Branch Naming Conventions

| Type        | Pattern                                  | Example                              |
|-------------|------------------------------------------|--------------------------------------|
| Feature     | `feat/<short-description>-<issue>`       | `feat/referral-bonus-101`            |
| Bug Fix     | `fix/<short-description>-<issue>`        | `fix/token-overflow-88`              |
| Documentation | `docs/<short-description>-<issue>`     | `docs/issue-430-contributing-standards` |
| Chore/Refactor | `chore/<short-description>-<issue>`   | `chore/cleanup-unused-deps-55`       |

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description> (#<issue>)
```

| Type       | When to use                              |
|------------|------------------------------------------|
| `feat`     | New feature                              |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `chore`    | Tooling, deps, config (no logic change)  |
| `refactor` | Code restructure without behavior change |
| `test`     | Adding or updating tests                 |

**Examples:**
```
feat(referral): add bonus multiplier logic (#101)
fix(token): prevent overflow on large reward amounts (#88)
docs: add contributing guidelines and issue templates (#430)
```

---

## Development Workflow

1. Pick an open issue or create one before starting work.
2. Comment on the issue to signal you're working on it.
3. Branch off `main`, make focused commits, and keep PRs small.
4. Run linting and tests locally before pushing.
5. Open a PR and fill out the checklist — see [Pull Request Process](docs/pr-process.md).

---

## Pull Request Process

See the full workflow and mandatory reviewer checklist in **[docs/pr-process.md](docs/pr-process.md)**.

---

## Reporting Bugs

Use the [Bug Report issue template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node version, browser, wallet)

---

## Requesting Features

Use the [Feature Request issue template](.github/ISSUE_TEMPLATE/feature_request.md) and describe:
- The problem you're solving
- Your proposed solution
- Any alternatives you considered

---

## Code Style Guide

See **[docs/code-style.md](docs/code-style.md)** for the full coding standards covering TypeScript/JavaScript, Rust/Soroban, naming conventions, and linting expectations.

---

## Required Reading

Before touching the blockchain layer, transaction logic, or Soroban contracts, read:

- **[Stellar & Soroban Integration Guide](docs/stellar/integration.md)**
- **[Contract Events Reference](docs/contract-events.md)**
- **[Upgrade Guide](docs/upgrade-guide.md)**

---

> Questions? Open a [Discussion](https://github.com/milah-247/Nova-Rewards/discussions) or drop a comment on the relevant issue.
