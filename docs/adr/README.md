# Architecture Decision Records

This directory records major architecture decisions for Nova Rewards. Each ADR
uses the same lightweight structure:

- **Status** — Proposed | Accepted | Deprecated | Superseded
- **Context** — The forces and constraints that drove the decision
- **Decision** — What was decided and why
- **Consequences** — Trade-offs, positive and negative
- **Related** — Links to code, diagrams, and other ADRs

---

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-layered-pwa-and-express-api.md) | Layered PWA and Express API | Accepted |
| [0002](0002-postgresql-system-of-record-with-redis-operational-cache.md) | PostgreSQL System of Record with Redis Operational Cache | Accepted |
| [0003](0003-stellar-and-soroban-for-reward-settlement.md) | Stellar and Soroban for Reward Settlement | Accepted |
| [0004](0004-idempotent-asynchronous-reward-issuance.md) | Idempotent Asynchronous Reward Issuance | Accepted |
| [0005](0005-modular-soroban-contracts.md) | Modular Soroban Contracts with Explicit Cross-Contract Calls | Accepted |
| [0006](0006-deployment-topology.md) | Compose for Staging and Helm on AWS for Production | Accepted |
| [0007](0007-jwt-rs256-authentication-strategy.md) | JWT RS256 Authentication Strategy | Accepted |
| [0008](0008-cursor-pagination-for-list-endpoints.md) | Cursor-Based Pagination for List Endpoints | Accepted |
| [0009](0009-bullmq-redis-job-queue.md) | BullMQ on Redis for Asynchronous Job Queue | Accepted |
| [0010](0010-redis-caching-strategy.md) | Redis Multi-Layer Caching Strategy | Accepted |
| [0011](0011-deployment-target-aws-kubernetes.md) | AWS as Production Deployment Target with Kubernetes (Helm) | Accepted |
| [0012](0012-monitoring-and-observability-stack.md) | Prometheus, Grafana, Loki, and Sentry Observability Stack | Accepted |
| [0013](0013-field-level-encryption-for-pii.md) | AES-256-GCM Field-Level Encryption for PII | Accepted |
| [0014](0014-soroban-rust-smart-contract-language.md) | Rust as the Smart Contract Language for Soroban | Accepted |

---

## Creating a New ADR

### When to write an ADR

Write an ADR whenever a decision:

- Affects multiple components or teams
- Is difficult or costly to reverse
- Involves a meaningful trade-off between alternatives
- Would otherwise be undocumented tribal knowledge

Small, local implementation choices (naming a variable, choosing a utility
function) do not need an ADR.

### Process

1. **Copy the template** — duplicate `TEMPLATE.md` (if present) or use the
   structure below.
2. **Pick the next number** — increment from the highest existing ADR number.
3. **Name the file** — `NNNN-short-hyphenated-title.md` (e.g.
   `0015-graphql-api-layer.md`).
4. **Set status to `Proposed`** — open a pull request for team review.
5. **Discuss in the PR** — record significant objections and alternatives
   considered in the **Context** section.
6. **Merge as `Accepted`** — once the team agrees, update the status and add
   the ADR to the index table above.
7. **Update when superseded** — if a later decision replaces this one, change
   the status to `Superseded by ADR-NNNN` and add a forward link.

### Template

```markdown
# ADR NNNN: Title

## Status

Proposed

## Context

<!-- What forces, constraints, or requirements drove this decision?
     What alternatives were considered? -->

## Decision

<!-- What was decided? Be specific about the chosen approach. -->

## Consequences

<!-- What are the positive and negative outcomes of this decision?
     What becomes easier? What becomes harder? -->

## Related

<!-- Links to relevant code files, diagrams, other ADRs, or external references. -->
```

### Tips

- Write in the past tense for **Accepted** ADRs ("We decided to use…") and
  present tense for **Proposed** ones ("We are considering…").
- Keep each ADR focused on a single decision. If two decisions are tightly
  coupled, consider whether they belong in one ADR or two.
- Link to the specific code files that implement the decision so future readers
  can navigate from the ADR to the implementation.
- If a decision is later reversed, do not delete the ADR — mark it
  `Deprecated` or `Superseded` and explain why. The history of *why* a decision
  was made is as valuable as the decision itself.
