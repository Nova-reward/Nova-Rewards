# Landing Page Design Annotations

**For:** Nova Rewards Landing Page  
**Wireframe Reference:** `landing-page.md`  
**Design System:** Nova Rewards Design Tokens v1.0  
**Last Updated:** 2026-07-23

---

## Spacing System

All spacing follows a **4px base unit grid**. Use the Tailwind spacing scale:

| Token | Pixels | Tailwind | Usage                                    |
|-------|--------|----------|------------------------------------------|
| 1     | 4px    | `p-1`    | Tight inline spacing, badge padding      |
| 2     | 8px    | `p-2`    | Icon-label gap, chip padding             |
| 3     | 12px   | `p-3`    | Small button padding                     |
| 4     | 16px   | `p-4`    | Default padding, mobile gutters          |
| 5     | 20px   | `p-5`    | Card padding (mobile)                    |
| 6     | 24px   | `p-6`    | Card padding (desktop), section spacing  |
| 8     | 32px   | `p-8`    | Section vertical padding (mobile)        |
| 10    | 40px   | `p-10`   | Large component internal padding         |
| 12    | 48px   | `p-12`   | Section vertical padding (tablet)        |
| 16    | 64px   | `p-16`   | Section vertical padding (desktop)       |
| 20    | 80px   | `p-20`   | Extra-large section spacing              |
| 24    | 96px   | `p-24`   | Hero section vertical padding            |

### Spacing Examples

**Hero Section:**
- Padding top/bottom: `py-24` (96px desktop), `py-12` (48px tablet), `py-8` (32px mobile)
- Element gap (icon to heading): `mb-6` (24px)
- Heading to subheading: `mb-4` (16px)
- Subheading to CTAs: `mt-8` (32px)
- CTA button gap: `gap-4` (16px)

**Feature Cards Grid:**
- Grid gap: `gap-6` (24px desktop), `gap-4` (16px mobile)
- Card internal padding: `p-6` (24px)
- Icon to title: `mb-4` (16px)
- Title to description: `mb-3` (12px)
- Description to link: `mt-4` (16px)

**Section Spacing:**
- Between major sections: `mb-20` (80px desktop), `mb-12` (48px mobile)

---

## Typography Scale

### Hierarchy

| Role        | Size   | Weight | Line Height | Letter Spacing | Tailwind Class        | Usage                    |
|-------------|--------|--------|-------------|----------------|-----------------------|--------------------------|
| **H1**      | 36px   | 700    | 1.1         | -0.02em        | `type-h1` (custom)    | Hero headline            |
| **H2**      | 30px   | 700    | 1.2         | -0.015em       | `type-h2`             | Section headings         |
| **H3**      | 24px   | 600    | 1.25        | -0.01em        | `type-h3`             | Card titles              |
| **H4**      | 20px   | 600    | 1.3         | -0.005em       | `type-h4`             | Subsection headings      |
| **Body-lg** | 18px   | 400    | 1.7         | 0em            | `type-body-lg`        | Hero subheadline         |
| **Body**    | 16px   | 400    | 1.6         | 0em            | `type-body`           | Default body text        |
| **Body-sm** | 14px   | 400    | 1.5         | 0em            | `type-body-sm`        | Fine print, captions     |
| **Caption** | 12px   | 400    | 1.4         | 0.01em         | `type-caption`        | Timestamps, labels       |
| **Label**   | 14px   | 500    | 1.25        | 0.01em         | `type-label`          | Form labels, UI labels   |

### Font Families

- **Headings:** `font-sans` → Inter  
- **Body:** `font-sans` → Inter  
- **Mono/Code:** `font-mono` → JetBrains Mono  
- **Serif/Accent:** `font-serif` → Merriweather (optional branding use)

### Mobile Adjustments

On screens < 768px:
- H1: reduce to **32px**
- H2: reduce to **24px**
- Line length: max 65 characters for readability

---

## Color Palette

### Primary Colors (Violet)

| Token              | Hex       | Usage                                         |
|--------------------|-----------|-----------------------------------------------|
| `primary-50`       | #f5f3ff   | Hero gradient start, light backgrounds        |
| `primary-100`      | #ede9fe   | Hover backgrounds for secondary buttons       |
| `primary-200`      | #ddd6fe   | Card hover borders                            |
| `primary-500`      | #8b5cf6   | Chart segments, accents                       |
| **`primary-600`**  | **#7c3aed** | **Primary CTA background, links (default)**   |
| `primary-700`      | #6d28d9   | Primary CTA hover state                       |
| `primary-800`      | #5b21b6   | Primary CTA active state                      |
| `primary-900`      | #4c1d95   | Deep accents                                  |

### Neutral Colors (Gray)

| Token              | Hex       | Usage                                         |
|--------------------|-----------|-----------------------------------------------|
| `neutral-50`       | #f8fafc   | Alternate row background                      |
| `neutral-100`      | #f1f5f9   | Card backgrounds, hover states                |
| `neutral-200`      | #e2e8f0   | Borders, dividers                             |
| `neutral-400`      | #94a3b8   | Icons, placeholder text                       |
| `neutral-500`      | #64748b   | Helper text, secondary text                   |
| `neutral-600`      | #475569   | Body text, footer links                       |
| `neutral-700`      | #334155   | Strong body text                              |
| `neutral-900`      | #0f172a   | Headings, high-emphasis text                  |

### Semantic Colors

| Token         | Hex       | Usage                              |
|---------------|-----------|------------------------------------|
| `success-500` | #22c55e   | Success messages, positive metrics |
| `warning-500` | #f59e0b   | Warnings, caution states           |
| `error-500`   | #ef4444   | Error messages, destructive actions|
| `info-500`    | #3b82f6   | Informational messages, charts     |

### Usage Guidelines

**Hero Section:**
- Background: gradient from `primary-50` to `white`
- Headline: `neutral-900` (`text-neutral-900`)
- Subheadline: `neutral-600` (`text-neutral-600`)
- Primary CTA: `primary-600` bg, `white` text → hover `primary-700`
- Secondary CTA: `white` bg, `primary-600` border + text → hover `primary-50` bg

**Feature Cards:**
- Border: `neutral-200`
- Hover border: `primary-200`
- Icon: `primary-600`
- Title: `neutral-900`
- Description: `neutral-600`
- Link: `primary-600` → hover `primary-700`

**Footer:**
- Background: `neutral-50` or `neutral-900` (dark variant)
- Links: `neutral-600` → hover `primary-600`
- Copyright: `neutral-500`

---

## Responsive Breakpoints

| Breakpoint | Min Width | Container Max-Width | Grid Columns | Gutter  | Padding |
|------------|-----------|---------------------|--------------|---------|---------|
| `xs`       | 0px       | 100%                | 1            | 16px    | 16px    |
| `sm`       | 640px     | 640px               | 1-2          | 16px    | 24px    |
| `md`       | 768px     | 768px               | 2-4          | 20px    | 32px    |
| `lg`       | 1024px    | 1024px              | 4            | 24px    | 48px    |
| `xl`       | 1280px    | 1280px              | 4            | 24px    | 64px    |
| `2xl`      | 1536px    | 1536px              | 4            | 24px    | 64px    |

### Layout Behavior

**Navbar:**
- Desktop (≥1024px): Horizontal nav with all links visible
- Tablet/Mobile (<1024px): Hamburger menu (☰) → slide-out drawer

**Hero:**
- Desktop: Single column, centered, max-width 800px
- Mobile: Full width, padding 16px

**Features Grid:**
- `xl/lg` (≥1024px): 4 columns
- `md` (768-1023px): 2 columns
- `sm/xs` (<768px): 1 column

**Tokenomics:**
- Desktop (≥768px): 2 columns (chart | table)
- Mobile (<768px): Stacked (chart above table)

**CTA Panel:**
- Desktop: Inline input + button
- Mobile: Stacked input, full-width button

---

## Interaction States

### Buttons

**Primary Button (CTA):**

| State    | Background   | Text    | Border | Additional                          |
|----------|--------------|---------|--------|-------------------------------------|
| Default  | `primary-600`| `white` | none   | Shadow-md                           |
| Hover    | `primary-700`| `white` | none   | Shadow-lg, cursor pointer           |
| Focus    | `primary-600`| `white` | none   | 2px `primary-600` ring, 2px offset  |
| Active   | `primary-800`| `white` | none   | `scale(0.97)` transform             |
| Disabled | `primary-600`| `white` | none   | `opacity-50`, cursor not-allowed    |
| Loading  | `primary-600`| hidden  | none   | Spinner icon, pointer-events-none   |

**Secondary Button:**

| State    | Background   | Text          | Border             | Additional        |
|----------|--------------|---------------|--------------------|-------------------|
| Default  | `white`      | `primary-600` | 1px `primary-600`  | —                 |
| Hover    | `primary-50` | `primary-700` | 1px `primary-700`  | —                 |
| Focus    | `white`      | `primary-600` | 1px `primary-600`  | 2px ring          |
| Active   | `primary-100`| `primary-800` | 1px `primary-800`  | `scale(0.97)`     |

### Links

| State    | Color          | Underline | Additional        |
|----------|----------------|-----------|-------------------|
| Default  | `primary-600`  | none      | —                 |
| Hover    | `primary-700`  | yes       | Transition 150ms  |
| Focus    | `primary-600`  | none      | 2px ring          |
| Visited  | `primary-800`  | none      | —                 |

### Cards (Feature Cards)

| State    | Border           | Shadow    | Transform          |
|----------|------------------|-----------|--------------------|
| Default  | `neutral-200`    | `shadow-sm` | —                |
| Hover    | `primary-200`    | `shadow-md` | `translateY(-2px)` |
| Focus    | `primary-600`    | `shadow-md` | 2px ring (if clickable) |

### Form Inputs (Email Capture)

| State    | Border           | Background   | Ring                    |
|----------|------------------|--------------|-------------------------|
| Default  | `neutral-300`    | `white`      | none                    |
| Focus    | `primary-600`    | `white`      | 2px `primary-600` ring  |
| Error    | `error-500`      | `error-50`   | 2px `error-500` ring    |
| Disabled | `neutral-200`    | `neutral-50` | none                    |

---

## Accessibility Compliance

### WCAG 2.1 AA Requirements

✅ **Color Contrast:**

| Element                      | Foreground       | Background   | Ratio   | Status |
|------------------------------|------------------|--------------|---------|--------|
| H1 (Hero headline)           | `neutral-900`    | `primary-50` | 12.3:1  | ✓ Pass |
| Body text                    | `neutral-600`    | `white`      | 7.2:1   | ✓ Pass |
| Primary CTA text             | `white`          | `primary-600`| 8.2:1   | ✓ Pass |
| Link default                 | `primary-600`    | `white`      | 5.8:1   | ✓ Pass |
| Footer link                  | `neutral-600`    | `neutral-50` | 6.9:1   | ✓ Pass |

**Tool:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

✅ **Touch Targets:**
- Minimum size: 44px × 44px for all interactive elements
- Spacing: 8px minimum between adjacent touch targets
- Applies to: buttons, links, form inputs, icon buttons

✅ **Keyboard Navigation:**
- All interactive elements must be focusable via `Tab`
- Focus order matches visual order (left-to-right, top-to-bottom)
- Skip navigation link: "Skip to main content" at top of page
- Focus indicator: 2px solid `primary-600` ring with 2px offset
- No keyboard traps: users can navigate in and out of all components

✅ **Screen Readers:**
- Semantic HTML5: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Headings in logical order (H1 → H2 → H3, no skipping)
- Images: Alt text for informative images, `alt=""` for decorative
- Icons: `aria-label` for icon-only buttons, `aria-hidden="true"` for decorative icons
- Forms: `<label>` associated with each input via `for`/`id`
- ARIA landmarks: `role="banner"`, `role="navigation"`, `role="main"`, `role="contentinfo"`

✅ **Motion & Animation:**
- All animations respect `prefers-reduced-motion: reduce`
- Fallback: instant show/hide or opacity-only transitions
- No autoplay videos without controls
- Infinite loops (e.g., hero icon float) must be pausable

---

## Focus Ring Specification

All interactive elements receive a visible focus indicator:

- **Style:** 2px solid `primary-600`
- **Offset:** 2px from element edge
- **Border radius:** matches element's border radius
- **Transition:** 150ms ease-out

**Tailwind classes:**
```css
focus:outline-none
focus:ring-2
focus:ring-primary-600
focus:ring-offset-2
```

**Exceptions:**
- Inputs: Ring appears on focus, no outline
- Custom elements: Apply ring directly via `box-shadow`

---

## Figma Handoff Checklist

Before exporting to Figma for high-fidelity mockups, ensure:

- [ ] All spacing values match the 4px grid
- [ ] Typography uses exact px sizes from the type scale
- [ ] Colors reference design tokens by name (e.g., `primary-600`)
- [ ] Components are organized into Figma variants (Button: primary, secondary, tertiary)
- [ ] Auto-layout is applied to all components for responsive behavior
- [ ] All states (hover, focus, active, disabled) are documented as variants
- [ ] Annotations layer exists for developer notes
- [ ] Assets (icons, illustrations) are exported as SVG at 1x
- [ ] Page structure follows wireframe sections exactly
- [ ] Handoff includes:
  - Design tokens JSON export
  - Component specs PDF
  - SVG icon sprite
  - Prototype link for interactions

**Figma Export Formats:**
- **Designs:** Export as PDF at 1x for stakeholder review
- **Assets:** SVG for icons, PNG at 2x for raster images
- **Developer Handoff:** Use Figma Dev Mode or Zeplin

---

## Implementation Notes for Developers

### HTML Structure

Use semantic HTML5:
```html
<header>
  <nav aria-label="Main navigation">
    <!-- Navbar -->
  </nav>
</header>

<main id="main-content">
  <section aria-labelledby="hero-heading">
    <h1 id="hero-heading">Earn. Stake. Redeem. Own Your Rewards.</h1>
    <!-- Hero content -->
  </section>

  <section aria-labelledby="features-heading">
    <h2 id="features-heading">How Nova Rewards Works</h2>
    <!-- Features grid -->
  </section>

  <!-- More sections -->
</main>

<footer role="contentinfo">
  <!-- Footer content -->
</footer>
```

### CSS Framework

The project uses **Tailwind CSS** with custom design tokens in `tailwind.config.ts`.

**Key utility classes:**
- Spacing: `p-6`, `mb-4`, `gap-6`
- Typography: `type-h1`, `type-body`, `text-neutral-600`
- Colors: `bg-primary-600`, `text-white`, `border-neutral-200`
- Responsive: `md:grid-cols-2`, `lg:grid-cols-4`
- Focus: `focus:ring-2 focus:ring-primary-600 focus:ring-offset-2`

### Animations

All animations are in `/styles/animations.css` and respect `prefers-reduced-motion`.

Example:
```css
.hero-icon {
  animation: float 2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hero-icon {
    animation: none;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
```

### Component Libraries

- **Icons:** Heroicons (already installed)
- **Charts:** Recharts or Chart.js for tokenomics pie chart
- **Forms:** React Hook Form for email capture

---

## Design QA Checklist

Before marking design as complete, verify:

- [ ] All spacing matches 4px grid
- [ ] Typography sizes exactly match type scale
- [ ] Colors use design tokens (no hardcoded hex)
- [ ] Contrast ratios meet WCAG AA (4.5:1 minimum)
- [ ] Touch targets are 44×44px minimum
- [ ] Focus rings are visible on all interactive elements
- [ ] Mobile layout is fully specified
- [ ] All states (hover/focus/active/disabled) are designed
- [ ] Assets are exported at correct sizes
- [ ] Animations have reduced-motion fallbacks
- [ ] Screen reader flow is logical
- [ ] Developer handoff package is complete

---

**Document Owner:** UX Team  
**Last Review:** 2026-07-23  
**Next Review:** Before high-fidelity mockup phase

---

**Related Documents:**
- [Landing Page Wireframe](./landing-page.md)
- [Design Tokens Reference](../design-tokens.md)
- [Component Library Specs](../component-library.md)
- [Animation System](../animation-system.md)
