# Nova Rewards Roadmap & Issue Tracker

**Last Updated:** `date`

## How to Use This Document

| Step | Action | Description |
|------|--------|-------------|
| 1 | **Prioritize** | Review issues and prioritize based on the project roadmap |
| 2 | **Assign** | Assign issues to team members based on expertise |
| 3 | **Track** | Use GitHub Issues to track progress with labels per category |
| 4 | **Update** | Update as issues are completed or new ones are identified |
| 5 | **Collaborate** | Use as a reference for team discussions and sprint planning |

## Next Steps

- [x] Create issue category labels (`.github/labels.yml`) — `frontend`, `backend`, `smart-contract`, `testing`, `devops`, `docs`, `ui-ux`
- [x] Add label sync workflow (`.github/workflows/sync-labels.yml`) to keep labels in sync with repo
- [ ] Import tasks from `docs/TASK_BREAKDOWN.md` into GitHub Issues using the appropriate labels
- [ ] Set up a [GitHub project board](https://docs.github.com/en/issues/planning-and-tracking-with-projects) for tracking work across categories
- [ ] Assign issues to team members based on expertise
- [ ] Begin implementation following the prioritized roadmap below

## Prioritization
Issues prioritized by project roadmap (README.md): Smart contracts first (foundational), then backend/frontend.

| Priority | Category | Rationale |
|----------|----------|-----------|
| High | Smart Contracts | Enables tokenized rewards, fee logic (contracts/) |
| Medium | Backend | Business logic (backend/routes/) |
| Low | Frontend/UI | Dashboards (novaRewards/, UIdesign) |

## Issues & Assignments

### High Priority
1. **RewardPool Fee Accumulation** (from contracts/reward_pool/TODO.md)
   - **Description**: Update contract for token, fees (bps), treasury, withdraw deductions, tests.
   - **Assignee**: @rust-dev (Rust/Soroban expert)
   - **Status**: TODO
   - **Tracking**: [GitHub Issue #1](https://github.com/issues/1) *(create via `gh issue create`) *
   - **Est. Effort**: 1-2 days

### Medium Priority (Placeholders)
2. **Backend API Routes**
   - **Assignee**: @backend-dev (Node/TS)
   - **Status**: Planned
   - **Tracking**: [GitHub Issue #2](#)

3. **Frontend Dashboard**
   - **Assignee**: @frontend-dev (React/Next.js)
   - **Status**: Planned
   - **Tracking**: [GitHub Issue #3](#)

## Tracking Process
- Use GitHub Issues for progress.
- Commands: `gh issue list`, `gh issue create/view`.
- Updates: Mark complete here/PRs.

## Collaboration
- Reference in team discussions/planning.
- Follow CONTRIBUTING.md: feature branches, Conventional Commits, link issues.
- New issues: Add here + GitHub.

Updates as issues complete/new identified.

