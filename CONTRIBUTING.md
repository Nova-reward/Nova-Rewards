# Contributing to Nova Rewards

Thanks for taking the time to contribute! This guide covers everything you need to go from zero to a merged pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Fork and Clone](#fork-and-clone)
  - [Local Development Setup](#local-development-setup)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Review Standards](#code-review-standards)
- [Issue Reporting](#issue-reporting)
- [Getting Help](#getting-help)

---

## Code of Conduct

Be respectful and constructive. We're all here to build something good together.

---

## Getting Started

### Fork and Clone

1. **Fork** the repository to your GitHub account using the **Fork** button at the top right.

2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Nova-Rewards.git
   cd Nova-Rewards
   ```

3. **Add the upstream remote** so you can pull in future changes:
   ```bash
   git remote add upstream https://github.com/Emoji-dot/Nova-Rewards.git
   ```

4. **Verify your remotes**:
   ```bash
   git remote -v
   # origin    https://github.com/YOUR_USERNAME/Nova-Rewards.git (fetch)
   # upstream  https://github.com/Emoji-dot/Nova-Rewards.git (fetch)
   ```

5. **Keep your fork up to date** before starting any new work:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

---

### Local Development Setup

#### Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 18.x | [nodejs.org](https://nodejs.org) |
| npm | 9.x | Bundled with Node.js |
| Rust | stable | [rustup.rs](https://rustup.rs) |
| Stellar CLI | latest | `cargo install --locked stellar-cli` |
| Docker (optional) | 24.x | [docker.com](https://www.docker.com) |

#### Frontend / Backend Setup

```bash
# Install dependencies
cd novaRewards
npm install

# Copy environment variables
cp ../.env.testnet .env.local
# Edit .env.local and fill in any required values

# Start the development server
npm run dev
```

#### Smart Contracts Setup

```bash
cd contracts

# Build all contracts
cargo build --release

# Run contract tests
cargo test

# Lint and format
cargo fmt --all
cargo clippy -- -D warnings
```

#### Verify Everything Works

```bash
# From the repo root — run all checks
npm run lint        # TypeScript/JS linting
npm run test        # Frontend/backend tests
cargo test          # Contract tests
```

If any step fails, check the [troubleshooting section in the README](./novaRewards/QUICK_START_PWA.md) or open a discussion.

---

## Branch Naming Conventions

Always branch off `main`. Use the following prefixes:

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feature/<short-description>` | `feature/add-referral-dashboard` |
| Bug fix | `fix/<issue-number>-<short-description>` | `fix/305-token-refresh-race` |
| Hotfix (production) | `hotfix/<short-description>` | `hotfix/critical-payout-bug` |
| Documentation | `docs/<short-description>` | `docs/update-contributing-guide` |
| Refactor | `refactor/<short-description>` | `refactor/reward-service-cleanup` |
| Chore / tooling | `chore/<short-description>` | `chore/upgrade-eslint` |

**Rules:**
- Use lowercase and hyphens only — no spaces or underscores.
- Keep descriptions short (3–5 words).
- Always include the issue number in `fix/` branches.

---

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This enables automatic changelog generation and clear history.

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code restructure with no feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks that don't touch src/tests |
| `revert` | Reverts a previous commit |

### Scope (optional)

Describes the area of the codebase affected. Examples: `auth`, `campaigns`, `contracts`, `ui`, `api`, `rewards`.

### Rules

- Use the **imperative, present tense**: "add feature" not "added feature".
- Keep the description under **72 characters**.
- Reference issues in the footer: `Closes #123` or `Fixes #456`.
- Mark breaking changes with `!` after the type or a `BREAKING CHANGE:` footer.

### Examples

```
feat(campaigns): add expiry date to reward campaigns

Allows campaign creators to set an end date. Campaigns automatically
deactivate when the expiry date is reached.

Closes #212
```

```
fix(auth): resolve token refresh race condition

Multiple concurrent requests were triggering duplicate refresh calls.
Added a mutex to serialize token refresh operations.

Fixes #305
```

```
docs: add local development setup to CONTRIBUTING.md
```

```
feat(contracts)!: change reward payout calculation to use basis points

BREAKING CHANGE: The `calculate_payout` function now expects amounts
in basis points instead of percentages.
```

---

## Pull Request Process

1. **Create a branch** following the [naming conventions](#branch-naming-conventions).

2. **Make your changes** and commit using the [commit format](#commit-message-format).

3. **Run all checks locally** before pushing:
   ```bash
   npm run lint && npm run test
   cargo fmt --all && cargo clippy -- -D warnings && cargo test
   ```

4. **Push your branch**:
   ```bash
   git push -u origin feature/your-branch-name
   ```

5. **Open a Pull Request** against `main` on GitHub. The [PR template](.github/pull_request_template.md) will load automatically — fill it out completely.

6. **Link the related issue** in the PR description using `Closes #<issue-number>`.

7. **Request a review** from at least one maintainer.

8. **Address review feedback** by pushing new commits. Do not force-push after a review has started.

9. **Await approval** — at least one approving review is required before merge.

10. **Squash and merge** — maintainers will squash commits on merge to keep `main` history clean.

### PR Size Guidelines

- Aim for PRs under **400 lines changed**.
- If a feature is large, break it into smaller sequential PRs.
- Smaller PRs get reviewed faster and are less likely to conflict.

---

## Code Review Standards

### For Authors

- Self-review your diff before requesting a review.
- Respond to all comments — either address them or explain why you disagree.
- Keep the PR up to date with `main` by rebasing or merging.
- Don't take feedback personally — reviewers are reviewing the code, not you.

### For Reviewers

- Aim to provide an initial review within **2 business days**.
- Be specific and constructive — suggest alternatives, don't just flag problems.
- Distinguish between blocking issues and non-blocking suggestions (use `nit:` prefix for minor style notes).
- Approve only when you're genuinely satisfied — a rubber-stamp approval helps no one.

### Code Review Checklist

Use this checklist when reviewing any PR:

**Scope & Intent**
- [ ] The PR addresses exactly one issue or concern
- [ ] The linked issue is referenced in the title/description
- [ ] No unrelated changes are included

**Code Quality**
- [ ] Code follows the [Code Style Guide](docs/code-style.md)
- [ ] No `any` types introduced (TypeScript)
- [ ] No commented-out code left behind
- [ ] No `console.log` or debug statements in production paths
- [ ] No secrets, keys, or credentials committed

**Correctness**
- [ ] Logic has been manually tested locally
- [ ] Edge cases and error paths are handled
- [ ] Existing tests still pass

**Contracts (if applicable)**
- [ ] Contract changes have a linked spec in `.kiro/specs/`
- [ ] `cargo clippy` passes with no warnings
- [ ] Contract tests pass (`cargo test`)

**Documentation**
- [ ] Relevant docs updated (README, inline comments, JSDoc/doc comments)
- [ ] CHANGELOG updated if this is a user-facing change

**PR Hygiene**
- [ ] Branch is up to date with `main`
- [ ] PR title follows Conventional Commits format
- [ ] PR description clearly explains *what* and *why*

---

## Issue Reporting

Before opening a new issue, search existing issues to avoid duplicates.

Use the appropriate template when creating an issue:

- **[Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)** — for reproducible bugs or unexpected behavior
- **[Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)** — for new features or improvements
- **[Task](.github/ISSUE_TEMPLATE/task.md)** — for general tasks or chores

### Issue Labels

| Label | Meaning |
|-------|---------|
| `bug` | Confirmed bug |
| `enhancement` | New feature or improvement |
| `documentation` | Docs-only change |
| `good first issue` | Suitable for new contributors |
| `help wanted` | Extra attention needed |
| `needs-triage` | Awaiting maintainer review |
| `P1-high` | High priority |
| `P2-medium` | Medium priority |
| `P3-low` | Low priority |

---

## Getting Help

- **Questions about the codebase?** Open a [GitHub Discussion](https://github.com/Emoji-dot/Nova-Rewards/discussions).
- **Found a security vulnerability?** See [docs/security/README.md](docs/security/README.md) — do **not** open a public issue.
- **Stuck on setup?** Check [novaRewards/QUICK_START_PWA.md](novaRewards/QUICK_START_PWA.md) or ask in Discussions.
