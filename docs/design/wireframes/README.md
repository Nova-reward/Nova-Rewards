# Wireframes Index — Nova Rewards

This directory contains all low-fidelity wireframes for the Nova Rewards platform.

## Status Key

| Symbol | Status      |
|--------|-------------|
| ✅     | Approved    |
| 🔄     | In Review   |
| 📝     | Draft       |
| 🚧     | In Progress |
| ⬜     | Not Started |

---

## Wireframe Files

| File | Section | Status | Owner | Last Updated |
|------|---------|--------|-------|--------------|
| [landing-page.md](./landing-page.md) | Marketing landing page: hero, features, tokenomics, CTA | 📝 Draft | UX Team | 2026-07-23 |
| [landing-page-annotations.md](./landing-page-annotations.md) | Design annotations: spacing, typography, color, a11y | 📝 Draft | UX Team | 2026-07-23 |
| [dashboard.md](./dashboard.md) | Main user dashboard: KPI cards, charts, transactions | 📝 Draft | UX Team | 2026-07-23 |
| [dashboard-data-viz.md](./dashboard-data-viz.md) | Data visualization specs: charts, graphs, sparklines | 📝 Draft | UX Team | 2026-07-23 |
| [responsive-grid.md](./responsive-grid.md) | Responsive grid system and breakpoint layouts | 📝 Draft | UX Team | 2026-07-23 |
| [onboarding-flow.md](./onboarding-flow.md) | Sign-up, wallet connect, first-run experience | 📝 Draft | UX Team | 2026-07-23 |
| [empty-states.md](./empty-states.md) | Empty state patterns across the platform | 📝 Draft | UX Team | 2026-07-23 |

---

## Section Descriptions

### Landing Page
The public marketing page that introduces Nova Rewards to new visitors. Covers:
- **Hero:** Headline, sub-headline, primary CTA, trust signals
- **Features:** 4-card grid (Earn, Redeem, Stake, Refer)
- **Tokenomics:** Pie chart, supply table, unlock schedule
- **CTA Panel:** Email capture for early access
- **Footer:** Navigation, social links, legal

### Dashboard
The authenticated main view after login. Covers:
- **Layout:** Sidebar navigation + main content area
- **KPI Cards:** Balance, earned points, active campaigns, referrals
- **Charts:** Rewards over time (line), token distribution (donut)
- **Recent Transactions:** Table with pagination
- **Responsive:** Desktop sidebar → tablet icon-only → mobile bottom nav

### Onboarding Flow
First-time user experience. Covers:
- **Sign-up:** 5-step flow with progress indicator
- **Wallet Connection:** Freighter integration steps
- **Empty States:** 6 variants for zero-data scenarios

---

## Design Tokens Reference

All wireframes reference design tokens defined in:
- [`docs/design/design-tokens.md`](../design-tokens.md) — Full token reference
- [`novaRewards/frontend/styles/tokens.css`](../../novaRewards/frontend/styles/tokens.css) — CSS custom properties
- [`novaRewards/frontend/tailwind.config.ts`](../../novaRewards/frontend/tailwind.config.ts) — Tailwind configuration

---

## Review Process

1. Designer creates draft wireframe
2. Product Manager reviews for requirements alignment
3. Engineering Lead reviews for feasibility
4. Stakeholders approve via sign-off table in each document
5. Designer creates high-fidelity Figma mockups based on approved wireframe
6. Figma link added to this index

---

## Contributing

To add a new wireframe:
1. Create a new `.md` file in this directory
2. Follow the template structure from `landing-page.md`
3. Add it to the table above
4. Submit PR with `docs/ux` label
