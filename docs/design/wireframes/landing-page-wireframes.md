# Landing Page Wireframes — Nova Rewards

> Issue: [#433](https://github.com/milah-247/Nova-Rewards/issues/433)  
> Status: Ready for stakeholder review  
> Last updated: 2026-04-27

---

## Overview

Low-fidelity wireframes for the Nova Rewards marketing / introduction page. The page is structured into four sections: **Hero**, **Features Grid**, **Tokenomics**, and **Call-to-Action**.

---

## Section 1 — Hero

```
┌─────────────────────────────────────────────────────────────────┐
│  [NOVA LOGO]                              [Docs]  [Launch App]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│          Loyalty Rewards,                  ┌──────────────┐    │
│          Powered by Blockchain             │              │    │
│                                            │  [NOVA Token │    │
│   Earn, hold, and redeem NOVA tokens       │   Icon/Anim] │    │
│   on the Stellar network. Transparent,     │              │    │
│   verifiable, and yours to keep.           └──────────────┘    │
│                                                                 │
│   [ Get Started — Free ]   [ View Docs ]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Headline: "Loyalty Rewards, Powered by Blockchain"
- Sub-headline: one-sentence value proposition (≤ 20 words)
- Primary CTA button: "Get Started — Free" → `/onboard`
- Secondary CTA: "View Docs" → `/docs`
- Token icon visual: animated NOVA coin (Lottie or CSS) — right-aligned on desktop, centred on mobile

---

## Section 2 — Features Grid

```
┌─────────────────────────────────────────────────────────────────┐
│                    Why Nova Rewards?                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────┐ │
│  │  🪙 Earn     │  │  🎁 Redeem   │  │  📈 Stake    │  │ 👥  │ │
│  │  Points      │  │  Rewards     │  │  Tokens      │  │Refer│ │
│  │              │  │              │  │              │  │     │ │
│  │ Shop at any  │  │ Exchange for │  │ Lock tokens  │  │Earn │ │
│  │ partner and  │  │ gift cards,  │  │ and earn     │  │bonus│ │
│  │ earn NOVA    │  │ merch, or    │  │ yield on     │  │NOVA │ │
│  │ tokens on    │  │ crypto       │  │ your balance │  │for  │ │
│  │ every txn.   │  │ cashback.    │  │ over time.   │  │each │ │
│  │              │  │              │  │              │  │ref. │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Cards (4):**

| # | Icon | Title | Body copy |
|---|------|-------|-----------|
| 1 | 🪙 | Earn Points | Shop at any partner merchant and earn NOVA tokens on every transaction. |
| 2 | 🎁 | Redeem Rewards | Exchange tokens for gift cards, merchandise, or crypto cashback instantly. |
| 3 | 📈 | Stake Tokens | Lock your NOVA balance and earn yield — no minimum, no lock-in period. |
| 4 | 👥 | Refer Friends | Share your referral link and earn bonus NOVA for every friend who joins. |

---

## Section 3 — Tokenomics

```
┌─────────────────────────────────────────────────────────────────┐
│                       NOVA Tokenomics                           │
│                                                                 │
│   ┌──────────────────────────┐   ┌───────────────────────────┐  │
│   │                          │   │  Supply Breakdown         │  │
│   │   [PIE CHART PLACEHOLDER]│   │                           │  │
│   │                          │   │  Rewards Pool    40%      │  │
│   │   Total Supply:          │   │  Ecosystem Fund  20%      │  │
│   │   1,000,000,000 NOVA     │   │  Team & Advisors 15%      │  │
│   │                          │   │  Public Sale     15%      │  │
│   │                          │   │  Reserve         10%      │  │
│   └──────────────────────────┘   └───────────────────────────┘  │
│                                                                 │
│   [ Read Full Tokenomics → ]                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Pie-chart placeholder (replace with Chart.js / Recharts in implementation)
- Supply breakdown table (5 rows)
- Link to `docs/tokenomics.md`

**Supply table:**

| Allocation | % | Tokens |
|------------|---|--------|
| Rewards Pool | 40% | 400,000,000 |
| Ecosystem Fund | 20% | 200,000,000 |
| Team & Advisors | 15% | 150,000,000 |
| Public Sale | 15% | 150,000,000 |
| Reserve | 10% | 100,000,000 |

---

## Section 4 — Call-to-Action Panel

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         Ready to earn smarter?                                  │
│         Join thousands of users already on Nova Rewards.        │
│                                                                 │
│              [ Create Free Account ]                            │
│                                                                 │
│         Already have an account?  Sign in →                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Headline + supporting copy
- Primary CTA: "Create Free Account" → `/register`
- Secondary link: "Sign in →" → `/login`
- Background: gradient or subtle pattern (brand colours)

---

## Responsive Behaviour

| Breakpoint | Layout notes |
|------------|-------------|
| Mobile (< 640 px) | Single-column; hero token icon stacks below headline; features grid 1-col |
| Tablet (640–1024 px) | Features grid 2-col; hero side-by-side |
| Desktop (> 1024 px) | Features grid 4-col; hero side-by-side with large token visual |

---

## Figma Links

> **Note:** Figma files are managed by the design team. Links will be added here once the frames are published.

- [ ] Lo-fi wireframe frame: _pending Figma publish_
- [ ] Component library reference: _pending_

To export PDFs from Figma: **File → Export → PDF** and place the file in this directory as `landing-page-wireframes.pdf`.

---

## Stakeholder Review Checklist

- [ ] Hero copy reviewed by marketing
- [ ] Features grid copy reviewed by product
- [ ] Tokenomics numbers verified against `docs/tokenomics.md`
- [ ] CTA destinations confirmed with engineering
- [ ] Accessibility contrast ratios checked (WCAG 2.1 AA)
- [ ] Mobile layout reviewed on physical device

---

## Handoff Notes

- Token icon animation: use the existing Lottie JSON at `docs/design/points-counter-increment.json` as a reference style.
- Animation timing: follow `docs/design/animation-spec.md` — entrance animations ≤ 300 ms.
- Colour tokens: use CSS custom properties from `docs/design/animation-tokens.css`.
- Component implementation should live in `novaRewards/frontend/pages/index.js` (or `pages/landing.js`).
