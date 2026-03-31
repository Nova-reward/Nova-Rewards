# Pull Request Process & Checklist

This document defines the end-to-end workflow for submitting and reviewing pull requests in Nova Rewards.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Step-by-Step PR Workflow](#step-by-step-pr-workflow)
- [PR Title Format](#pr-title-format)
- [Reviewer Checklist](#reviewer-checklist)
- [Review Turnaround](#review-turnaround)
- [Merging](#merging)

---

## Before You Start

- Make sure an issue exists for your change. If not, create one first.
- Comment on the issue to let others know you're working on it.
- Branch off `main` using the correct [branch naming convention](../CONTRIBUTING.md#branch-naming-conventions).

---

## Step-by-Step PR Workflow

1. **Implement** your changes on a dedicated branch.
2. **Run checks locally** before pushing:
   ```bash
   npm run lint
   npm run test
   # For contracts:
   cargo fmt --all && cargo clippy -- -D warnings && cargo test
   ```
3. **Push** your branch to your fork or the origin remote.
4. **Open a Pull Request** against `main` on GitHub.
5. **Fill in the PR description** — use the template below and complete every checkbox.
6. **Request a review** from at least one maintainer.
7. **Address feedback** — push follow-up commits; do not force-push after review starts.
8. **Await approval** — at least one approving review is required before merge.

---

## PR Title Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) in the PR title:

```
<type>(<scope>): <short description> (#<issue>)
```

**Examples:**
```
feat(campaigns): add expiry date to reward campaigns (#212)
fix(auth): resolve token refresh race condition (#305)
docs: add PR process and checklist (#430)
```

---

## Reviewer Checklist

Copy this checklist into your PR description and check every item before requesting review.

```markdown
## Reviewer Checklist

### Scope & Intent
- [ ] The PR addresses exactly one issue or concern
- [ ] The linked issue number is referenced in the title and description
- [ ] No unrelated changes are included

### Code Quality
- [ ] Code follows the [Code Style Guide](docs/code-style.md)
- [ ] No `any` types introduced (TypeScript)
- [ ] No commented-out code left behind
- [ ] No `console.log` / debug statements in production paths
- [ ] No secrets, keys, or credentials committed

### Correctness
- [ ] Logic has been manually tested locally
- [ ] Edge cases and error paths are handled
- [ ] Existing tests still pass (`npm run test`)

### Contracts (if applicable)
- [ ] Contract changes have a linked spec in `.kiro/specs/`
- [ ] `cargo clippy` passes with no warnings
- [ ] Contract tests pass (`cargo test`)

### Documentation
- [ ] Relevant docs updated (README, inline comments, JSDoc)
- [ ] CHANGELOG updated if this is a user-facing change

### PR Hygiene
- [ ] Branch is up to date with `main`
- [ ] PR title follows Conventional Commits format
- [ ] PR description clearly explains *what* and *why*
```

---

## Review Turnaround

- Maintainers aim to provide an initial review within **2 business days**.
- If you haven't heard back in 3 days, feel free to ping the issue or PR thread.
- Keep PRs small and focused — large PRs take longer to review and are more likely to have conflicts.

---

## Merging

- PRs are merged using **Squash and Merge** to keep the `main` history clean.
- The squash commit message must follow the Conventional Commits format.
- Only maintainers can merge into `main`.
- Delete your branch after merge.
