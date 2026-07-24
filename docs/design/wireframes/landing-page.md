# Landing Page Wireframe — Nova Rewards

**Version:** 1.0  
**Status:** Draft for Review  
**Last Updated:** 2026-07-23  
**Owner:** UX Team

---

## Overview

This document provides low-fidelity wireframes for the Nova Rewards marketing landing page. The page introduces the blockchain loyalty platform, highlights key features, explains tokenomics, and drives sign-up conversions.

**Goals:**
- Communicate the value proposition within 5 seconds
- Drive wallet connection and account creation
- Establish trust with clear tokenomics
- Optimize for mobile-first experience

---

## Layout Structure

### Desktop (1280px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  NAVBAR                                                                     │
│  [Logo] Nova Rewards         Features  Tokenomics  Docs    [Connect Wallet]│
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                             HERO SECTION                                    │
│                                                                             │
│              ╔═══════════════════════════════════════╗                      │
│              ║    [NOVA Token Icon - 120x120px]     ║                      │
│              ╚═══════════════════════════════════════╝                      │
│                                                                             │
│                  Earn. Stake. Redeem. Own Your Rewards.                    │
│                          [H1 - 48px, bold]                                 │
│                                                                             │
│         Transform loyalty into crypto. Earn NOVA tokens with every         │
│              purchase, stake for rewards, redeem instantly.                │
│                     [Subheadline - 18px, regular]                          │
│                                                                             │
│            ┌──────────────────┐    ┌──────────────────┐                   │
│            │  Get Started →   │    │   View Docs      │                   │
│            │  [Primary CTA]   │    │ [Secondary CTA]  │                   │
│            └──────────────────┘    └──────────────────┘                   │
│                                                                             │
│              🏆 Trusted by 50K+ users  |  💎 Built on Stellar              │
│                      [Trust badges row - 14px]                             │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                          FEATURES SECTION                                   │
│                         How Nova Rewards Works                             │
│                              [H2 - 36px]                                   │
│                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────┐ │
│  │   [Icon 48px]  │  │   [Icon 48px]  │  │   [Icon 48px]  │  │  [Icon] │ │
│  │       💰       │  │       🎁       │  │       📈       │  │    🔗   │ │
│  │                │  │                │  │                │  │         │ │
│  │  Earn Points   │  │Redeem Rewards  │  │  Stake Tokens  │  │  Refer  │ │
│  │  [H3 - 20px]   │  │  [H3 - 20px]   │  │  [H3 - 20px]   │  │ Friends │ │
│  │                │  │                │  │                │  │         │ │
│  │ Shop at partner│  │ Exchange NOVA  │  │ Lock tokens to │  │ Invite  │ │
│  │ merchants and  │  │ for gift cards,│  │ earn APY and   │  │ friends │ │
│  │ earn NOVA with │  │ discounts, and │  │ governance     │  │ and earn│ │
│  │ every purchase.│  │ exclusive perks│  │ voting power.  │  │ 10% of  │ │
│  │ [Body - 16px]  │  │ [Body - 16px]  │  │ [Body - 16px]  │  │  their  │ │
│  │                │  │                │  │                │  │ rewards │ │
│  │ [Learn More →] │  │ [Learn More →] │  │ [Learn More →] │  │[More →] │ │
│  └────────────────┘  └────────────────┘  └────────────────┘  └─────────┘ │
│                                                                             │
│                     [Cards: 280px width, 320px height]                     │
│                     [Gap: 24px, Padding: 24px each]                        │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        TOKENOMICS SECTION                                   │
│                         NOVA Token Economics                               │
│                              [H2 - 36px]                                   │
│                                                                             │
│       ┌──────────────────────────┐      ┌─────────────────────────────┐   │
│       │   PIE CHART (ASCII)      │      │  Supply Breakdown           │   │
│       │                          │      │  [Table - 16px]             │   │
│       │        ╱───╲             │      │                             │   │
│       │      ╱   40% ╲           │      │ Total Supply:  1,000,000,000│   │
│       │     │  Comm.  │          │      │                   NOVA       │   │
│       │     │ Rewards │          │      │                             │   │
│       │      ╲       ╱           │      │ Community Rewards    40%    │   │
│       │    20% ╲___╱ 15%         │      │ Staking Rewards      20%    │   │
│       │   Staking  Team          │      │ Team & Advisors      15%    │   │
│       │                          │      │ Treasury Reserve     15%    │   │
│       │    15%        10%        │      │ Liquidity Pool       10%    │   │
│       │  Treasury  Liquidity     │      │                             │   │
│       │                          │      │ ─────────────────────────   │   │
│       │  [400x400px chart]       │      │                             │   │
│       └──────────────────────────┘      │ Unlock Schedule:            │   │
│                                         │ • Community: Linear 4 years │   │
│                                         │ • Team: 1yr cliff, 3yr vest │   │
│                                         │ • Staking: Ongoing rewards  │   │
│                                         └─────────────────────────────┘   │
│                                                                             │
│              [Whitepaper Download →]  [Audit Report →]                     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                          CTA PANEL SECTION                                  │
│                                                                             │
│                        Start Earning Rewards Today                         │
│                              [H2 - 36px]                                   │
│                                                                             │
│              Join 50,000+ users earning crypto loyalty rewards             │
│                          [Subheading - 18px]                               │
│                                                                             │
│              ┌────────────────────────────────────────────┐                │
│              │  Email address                    [Submit] │                │
│              │  [Input field - 48px height]      [Button] │                │
│              └────────────────────────────────────────────┘                │
│                                                                             │
│                  No credit card required • Connect wallet instantly        │
│                              [Fine print - 14px]                           │
│                                                                             │
│                     or [Read Documentation →]                              │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              FOOTER                                         │
│                                                                             │
│  [Logo] Nova Rewards                          Connect:  𝕏  Discord  GitHub │
│                                                                             │
│  Product            Developers        Company          Legal               │
│  • Features         • Documentation   • About          • Terms             │
│  • Tokenomics       • API Reference   • Blog           • Privacy           │
│  • Staking          • GitHub          • Careers        • Cookies           │
│  • Rewards          • Smart Contracts • Contact                            │
│                                                                             │
│  © 2026 Nova Rewards. Built on Stellar.                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout (< 768px)

```
┌─────────────────────────────────────┐
│  NAVBAR (collapsed)                 │
│  [☰ Menu]  Nova    [Connect Wallet] │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         HERO (stacked)              │
│                                     │
│       [NOVA Icon - 80x80px]         │
│                                     │
│   Earn. Stake. Redeem.              │
│   Own Your Rewards.                 │
│       [H1 - 32px]                   │
│                                     │
│  Transform loyalty into             │
│  crypto. Earn NOVA with             │
│  every purchase.                    │
│    [Subheading - 16px]              │
│                                     │
│  ┌─────────────────────────┐        │
│  │   Get Started →         │        │
│  │   [Full-width CTA]      │        │
│  └─────────────────────────┘        │
│                                     │
│  ┌─────────────────────────┐        │
│  │   View Docs             │        │
│  │   [Secondary full-width]│        │
│  └─────────────────────────┘        │
│                                     │
│  🏆 50K+ users | 💎 Stellar         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      FEATURES (1 column)            │
│                                     │
│  ┌───────────────────────────────┐  │
│  │     [Icon 40px]  💰          │  │
│  │     Earn Points              │  │
│  │     [H3 - 18px]              │  │
│  │                              │  │
│  │  Shop at partners and earn   │  │
│  │  NOVA with every purchase.   │  │
│  │  [Body - 16px]               │  │
│  │                              │  │
│  │  [Learn More →]              │  │
│  └───────────────────────────────┘  │
│                                     │
│  [3 more cards stacked...]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     TOKENOMICS (stacked)            │
│                                     │
│  [Pie chart - 280x280px]            │
│                                     │
│  [Table below chart]                │
│  Total: 1B NOVA                     │
│  • Community: 40%                   │
│  • Staking: 20%                     │
│  • Team: 15%                        │
│  [etc...]                           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      CTA PANEL                      │
│                                     │
│  Start Earning Today                │
│  [H2 - 28px]                        │
│                                     │
│  ┌─────────────────────────┐        │
│  │  Email address          │        │
│  │  [Input - full width]   │        │
│  └─────────────────────────┘        │
│                                     │
│  ┌─────────────────────────┐        │
│  │  Submit                 │        │
│  │  [Button - full width]  │        │
│  └─────────────────────────┘        │
└─────────────────────────────────────┘

[Footer - simplified, stacked]
```

---

## Component Specifications

### Hero Section

**Dimensions:**
- Desktop height: 600px
- Mobile height: auto (content-driven)
- Token icon: 120px × 120px desktop, 80px × 80px mobile
- Vertical padding: 64px desktop, 32px mobile

**Content:**
- H1: "Earn. Stake. Redeem. Own Your Rewards."
- Subheadline: 1-2 sentences, max 120 characters
- Primary CTA: "Get Started" → /onboarding
- Secondary CTA: "View Docs" → /docs
- Trust badges: User count, blockchain platform, security badge

**Visual Style:**
- Background: gradient from primary-50 to white
- Token icon: animated subtle float (2s loop)
- CTAs: 16px gap between buttons

### Features Grid

**Layout:**
- Desktop: 4 columns, 24px gap
- Tablet: 2 columns, 20px gap
- Mobile: 1 column, 16px gap

**Card Specs:**
- Width: 280px (auto on mobile)
- Height: 320px min-height
- Padding: 24px
- Border radius: 12px
- Border: 1px solid neutral-200
- Shadow: sm on default, md on hover

**Content per Card:**
- Icon: 48px × 48px, primary-600 color
- Title: H3 (20px/600)
- Description: 2-3 lines, 16px/400
- Link: "Learn More →" in primary-600

### Tokenomics Section

**Layout:**
- Desktop: 2 columns (chart | table)
- Mobile: stacked (chart above table)

**Pie Chart:**
- Dimensions: 400px × 400px desktop, 280px × 280px mobile
- Colors: primary-500, secondary-500, success-500, warning-500, info-500
- Labels: percentage + category name
- Interactive: hover to highlight segment
- Accessible: ARIA label with full breakdown

**Supply Table:**
- Font: mono for numbers (alignment)
- Row height: 40px
- Zebra striping: neutral-50 on even rows

### CTA Panel

**Style:**
- Background: primary-600
- Text color: white
- Padding: 64px vertical, 32px horizontal
- Border radius: 16px (if inset), 0 (if full-width)

**Email Capture:**
- Input width: 400px desktop, 100% mobile
- Input + button inline on desktop
- Stacked on mobile
- Input height: 48px (meets touch target minimum)

### Footer

**Structure:**
- Logo + social icons: left-aligned
- 4 column nav: product, developers, company, legal
- Copyright: centered below columns
- Mobile: accordion collapsed sections

**Link Specs:**
- Color: neutral-600
- Hover: primary-600
- Font size: 14px
- Line height: 2rem (generous tap target)

---

## Responsive Breakpoints

| Breakpoint | Width     | Layout                          |
|------------|-----------|----------------------------------|
| `xs`       | < 640px   | Single column, stacked           |
| `sm`       | 640-767px | Single column, larger spacing    |
| `md`       | 768-1023px| 2 columns where applicable       |
| `lg`       | 1024-1279px| Full 4-column grid              |
| `xl`       | ≥ 1280px  | Max-width container, centered    |

---

## Accessibility Requirements

✅ **Keyboard Navigation:**
- All interactive elements focusable in logical order
- Skip navigation link at top
- Focus visible: 2px violet ring, 2px offset

✅ **Screen Readers:**
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- ARIA labels for icon-only buttons
- Alt text for all images (including decorative with alt="")
- Pie chart: `<figure>` with `<figcaption>` text breakdown

✅ **Color Contrast:**
- All text meets WCAG AA minimum 4.5:1 for normal text, 3:1 for large text
- Primary CTA: white on primary-600 = 8.2:1 ✓
- Body text: neutral-700 on white = 10.5:1 ✓

✅ **Touch Targets:**
- Minimum 44px × 44px for all interactive elements
- 8px spacing between adjacent touch targets

✅ **Motion:**
- All animations respect `prefers-reduced-motion`
- Hero icon float animation disabled if user prefers reduced motion

---

## Interaction States

### Buttons

| State    | Style                                             |
|----------|---------------------------------------------------|
| Default  | Primary-600 bg, white text                        |
| Hover    | Primary-700 bg, cursor pointer                    |
| Focus    | 2px violet ring, 2px offset                       |
| Active   | Primary-800 bg, scale(0.97)                       |
| Disabled | Opacity 50%, cursor not-allowed                   |

### Cards

| State    | Style                                             |
|----------|---------------------------------------------------|
| Default  | Shadow-sm, border neutral-200                     |
| Hover    | Shadow-md, translateY(-2px), border primary-200   |
| Focus    | 2px violet ring (if card is clickable)            |

### Links

| State    | Style                                             |
|----------|---------------------------------------------------|
| Default  | Primary-600 text, no underline                    |
| Hover    | Primary-700 text, underline                       |
| Focus    | 2px violet ring                                   |
| Visited  | Primary-800 text                                  |

---

## Stakeholder Review Checklist

**Before marking this wireframe as approved, confirm:**

- [ ] Value proposition is clear within 5 seconds
- [ ] Primary CTA is obvious and above the fold
- [ ] Feature cards accurately represent product capabilities
- [ ] Tokenomics data matches whitepaper
- [ ] All links and CTAs have defined destinations
- [ ] Mobile layout is functional and finger-friendly
- [ ] Accessibility requirements are documented
- [ ] Legal team has reviewed footer links
- [ ] Marketing has approved all copy
- [ ] Design tokens (colors, spacing, typography) are correct
- [ ] Animations are purposeful, not decorative
- [ ] Loading states are defined (see separate doc)

**Reviewers:**

| Role            | Name | Date | Status |
|-----------------|------|------|--------|
| Product Manager |      |      | ⏳ Pending |
| UX Designer     |      |      | ⏳ Pending |
| Engineering Lead|      |      | ⏳ Pending |
| Marketing Lead  |      |      | ⏳ Pending |
| Legal Counsel   |      |      | ⏳ Pending |

---

## Next Steps

1. **High-Fidelity Mockups:** Translate wireframes to pixel-perfect designs in Figma
2. **Content Writing:** Finalize all copy with brand voice
3. **Asset Creation:** Design NOVA token icon, feature illustrations
4. **Prototype:** Build interactive Figma prototype for usability testing
5. **Developer Handoff:** Export Figma file with annotations, provide design tokens JSON

**Figma File:** [Link placeholder — export as PDF for stakeholders without Figma access]

---

**Changelog:**

| Date       | Version | Changes                          | Author   |
|------------|---------|----------------------------------|----------|
| 2026-07-23 | 1.0     | Initial wireframe draft          | UX Team  |
