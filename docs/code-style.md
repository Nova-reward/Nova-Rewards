# Code Style Guide

This document defines the coding standards for Nova Rewards. Consistent style keeps the codebase readable and maintainable for everyone.

---

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript & JavaScript](#typescript--javascript)
- [Rust / Soroban Contracts](#rust--soroban-contracts)
- [Naming Conventions](#naming-conventions)
- [File & Folder Structure](#file--folder-structure)
- [Linting & Formatting](#linting--formatting)
- [Comments & Documentation](#comments--documentation)

---

## General Principles

- **Clarity over cleverness** — write code that the next person can understand immediately.
- **Small, focused units** — functions and modules should do one thing well.
- **No secrets in source** — never commit API keys, private keys, or credentials.
- **Fail loudly** — prefer explicit error handling over silent failures.

---

## TypeScript & JavaScript

### Language

- Use **TypeScript** for all new frontend and backend code.
- Avoid `any` — use proper types or `unknown` with narrowing.
- Enable strict mode (`"strict": true` in `tsconfig.json`).

### Syntax

```ts
// ✅ Good
const getUserBalance = async (userId: string): Promise<number> => {
  const user = await db.users.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  return user.balance;
};

// ❌ Avoid
async function getBalance(id) {
  const u = await db.users.findById(id);
  return u.balance;
}
```

- Prefer `const` over `let`; never use `var`.
- Use `async/await` over raw `.then()` chains.
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate.
- Destructure objects and arrays when it improves readability.

### Imports

- Group imports: external packages → internal modules → types.
- Use absolute imports where the project supports path aliases.

```ts
// External
import express from 'express';

// Internal
import { rewardUser } from '@/services/rewardService';

// Types
import type { Campaign } from '@/types';
```

---

## Rust / Soroban Contracts

- Follow the [Soroban SDK conventions](https://developers.stellar.org/docs/smart-contracts).
- All public contract functions must have doc comments (`///`).
- Keep contract logic pure where possible — avoid side effects in helper functions.
- Do **not** modify `contracts/` without a linked spec in `.kiro/specs/`.

```rust
/// Issues reward tokens to a user after a qualifying action.
pub fn issue_reward(env: Env, recipient: Address, amount: i128) -> Result<(), Error> {
    recipient.require_auth();
    // ...
}
```

---

## Naming Conventions

| Context              | Convention         | Example                        |
|----------------------|--------------------|--------------------------------|
| Variables & functions | `camelCase`       | `getUserRewards`, `tokenAmount` |
| React components     | `PascalCase`       | `RewardCard`, `CampaignList`   |
| Constants            | `UPPER_SNAKE_CASE` | `MAX_REWARD_LIMIT`             |
| Files (TS/JS)        | `kebab-case`       | `reward-service.ts`            |
| Files (React)        | `PascalCase`       | `RewardCard.tsx`               |
| Rust functions       | `snake_case`       | `issue_reward`, `get_balance`  |
| Rust types/structs   | `PascalCase`       | `RewardPool`, `AdminRole`      |
| Database columns     | `snake_case`       | `user_id`, `created_at`        |
| Environment vars     | `UPPER_SNAKE_CASE` | `STELLAR_SECRET_KEY`           |

---

## File & Folder Structure

- One component or service per file.
- Co-locate tests with the code they test (e.g., `reward-service.test.ts` next to `reward-service.ts`), or place them in the nearest `__tests__/` folder.
- Keep files under ~300 lines; split if they grow larger.

---

## Linting & Formatting

The project uses **ESLint** and **Prettier**. Run before every commit:

```bash
# Backend / Frontend (Node.js)
npm run lint
npm run format

# Contracts (Rust)
cargo fmt --all
cargo clippy -- -D warnings
```

- ESLint config lives in `novaRewards/backend/.eslintrc.js`.
- PRs with lint errors will not be merged.
- Consider installing the ESLint and Prettier extensions in your editor for real-time feedback.

---

## Comments & Documentation

- Write comments to explain **why**, not **what** — the code shows what.
- Use JSDoc for exported functions and types:

```ts
/**
 * Calculates the reward multiplier for a given campaign tier.
 * @param tier - Campaign tier level (1–5)
 * @returns Multiplier value between 1.0 and 3.0
 */
export const getMultiplier = (tier: number): number => { ... };
```

- Keep comments up to date — stale comments are worse than no comments.
- Remove commented-out code before opening a PR.
