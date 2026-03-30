# Nova Rewards Project Management TODO

## Plan Tracking (Prioritization, Assignment, GitHub Tracking)

### High Priority: Smart Contracts (Roadmap: Foundational for token rewards)
- [ ] RewardPool Fee Accumulation (contracts/reward_pool/TODO.md)
  - Priority: High (enables fee/tresury logic)
  - Assignee: @rust-dev (Rust/Soroban expertise)
  - Tracking: Create GitHub Issue #1
  - Steps:
    1. Update DataKey enum (Token, FeeBps, Treasury)
    2. Update initialize(token: Address)
    3. Add update_fee(u32), update_treasury(Address) (admin)
    4. get_treasury_balance() -> i128
    5. Modify withdraw (fee/net calc, transfers, event)
    6. Tests (zero-fee, bps, accumulation)
    7. cargo test & snapshots
    8. Complete

### Medium Priority: Backend/Frontend (Post-contracts)
- [ ] Setup backend routes (Node.js/TS)
  - Assignee: @backend-dev
- [ ] Frontend dashboard (React/Next.js)
  - Assignee: @frontend-dev

### Setup & Collaboration
- [x] Create ROADMAP.md (this doc reference)
- [ ] GitHub repo setup & Issues (gh auth needed; run `gh auth login --web`)
- [ ] Update on completion/PRs (link issues)

Last Updated: $(date)
Use for team discussions. Follow CONTRIBUTING.md for branches/commits.

