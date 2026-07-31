# Design Tokens Reference — Nova Rewards

**Version:** 1.0  
**Source of Truth:** `novaRewards/frontend/tailwind.config.ts` + `styles/tokens.css`  
**Last Updated:** 2026-07-23

Design tokens are the atomic values of the Nova Rewards design system. Every color, spacing value, font size, and animation duration is defined here. Use these tokens—never hardcode values.

---

## Color System

### Primary — Violet (Brand Identity)

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `primary-50` | `--color-primary-50` | `#f5f3ff` | Hero gradients, light hover backgrounds |
| `primary-100` | `--color-primary-100` | `#ede9fe` | Secondary button hover |
| `primary-200` | `--color-primary-200` | `#ddd6fe` | Card hover borders, focus ring light |
| `primary-300` | `--color-primary-300` | `#c4b5fd` | Disabled state accents |
| `primary-400` | `--color-primary-400` | `#a78bfa` | Chart secondary segments |
| `primary-500` | `--color-primary-500` | `#8b5cf6` | Chart primary segments, decorative |
| **`primary-600`** | `--color-primary-600` | **`#7c3aed`** | **CTAs, links, focus rings, interactive default** |
| `primary-700` | `--color-primary-700` | `#6d28d9` | CTA hover, link hover |
| `primary-800` | `--color-primary-800` | `#5b21b6` | CTA active, link active |
| `primary-900` | `--color-primary-900` | `#4c1d95` | Dark mode headings |
| `primary-950` | `--color-primary-950` | `#2e1065` | Deep brand accents |

**Dark Mode Pairs:**
- Background elements use `primary-900` → `primary-950`
- Interactive default on dark: `primary-400` → hover `primary-300`

---

### Secondary — Indigo (Accent)

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `secondary-50` | `--color-secondary-50` | `#eef2ff` | Light accent backgrounds |
| `secondary-100` | `--color-secondary-100` | `#e0e7ff` | Notification backgrounds |
| `secondary-200` | `--color-secondary-200` | `#c7d2fe` | Subtle accent borders |
| `secondary-300` | `--color-secondary-300` | `#a5b4fc` | Chart tertiary segments |
| `secondary-400` | `--color-secondary-400` | `#818cf8` | Decorative elements |
| `secondary-500` | `--color-secondary-500` | `#6366f1` | Chart accents, badge colors |
| `secondary-600` | `--color-secondary-600` | `#4f46e5` | Secondary action color |
| `secondary-700` | `--color-secondary-700` | `#4338ca` | Secondary hover |
| `secondary-800` | `--color-secondary-800` | `#3730a3` | Visited links (alternative) |
| `secondary-900` | `--color-secondary-900` | `#312e81` | Deep accent |
| `secondary-950` | `--color-secondary-950` | `#1e1b4b` | Dark brand surface |

---

### Neutral — Slate Gray

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `neutral-50` | `--color-neutral-50` | `#f8fafc` | Page backgrounds, table alternate rows |
| `neutral-100` | `--color-neutral-100` | `#f1f5f9` | Card backgrounds, ghost hover |
| `neutral-200` | `--color-neutral-200` | `#e2e8f0` | Borders, dividers, skeleton bg |
| `neutral-300` | `--color-neutral-300` | `#cbd5e1` | Input borders (default) |
| `neutral-400` | `--color-neutral-400` | `#94a3b8` | Icons (inactive), placeholder text |
| `neutral-500` | `--color-neutral-500` | `#64748b` | Helper text, metadata, timestamps |
| `neutral-600` | `--color-neutral-600` | `#475569` | Body text, secondary content |
| `neutral-700` | `--color-neutral-700` | `#334155` | Strong body text, list items |
| `neutral-800` | `--color-neutral-800` | `#1e293b` | Dark surface cards |
| `neutral-900` | `--color-neutral-900` | `#0f172a` | **Primary headings, dark backgrounds** |
| `neutral-950` | `--color-neutral-950` | `#020617` | Black variant |

---

### Semantic — Status Colors

#### Success (Green)
| Token | Hex | Usage |
|-------|-----|-------|
| `success-50` | `#f0fdf4` | Success message background |
| `success-100` | `#dcfce7` | Success badge background |
| `success-500` | `#22c55e` | Success icons, positive trends |
| `success-600` | `#16a34a` | Success button, checkmarks |
| `success-700` | `#15803d` | Success hover state |

#### Warning (Amber)
| Token | Hex | Usage |
|-------|-----|-------|
| `warning-50` | `#fffbeb` | Warning message background |
| `warning-100` | `#fef3c7` | Warning badge background |
| `warning-500` | `#f59e0b` | Warning icons, pending status |
| `warning-600` | `#d97706` | Warning interactive state |
| `warning-700` | `#b45309` | Warning hover state |

#### Error (Red)
| Token | Hex | Usage |
|-------|-----|-------|
| `error-50` | `#fef2f2` | Error message background |
| `error-100` | `#fee2e2` | Error badge background |
| `error-500` | `#ef4444` | Error icons, destructive indicators |
| `error-600` | `#dc2626` | Danger button, error states |
| `error-700` | `#b91c1c` | Danger hover, high severity |

#### Info (Blue)
| Token | Hex | Usage |
|-------|-----|-------|
| `info-50` | `#eff6ff` | Info message background |
| `info-100` | `#dbeafe` | Info badge background |
| `info-500` | `#3b82f6` | Info icons, neutral metrics |
| `info-600` | `#2563eb` | Info interactive |
| `info-700` | `#1d4ed8` | Info hover |

---

## Typography

### Font Families

| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| `font-sans` | `--font-sans` | `'Inter', ui-sans-serif, system-ui, sans-serif` | All UI text, headings, body |
| `font-serif` | `--font-serif` | `'Merriweather', ui-serif, Georgia, serif` | Branding copy, editorial content |
| `font-mono` | `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` | Code, wallet addresses, hashes |

> **Loading:** Inter is loaded via `next/font` for zero layout shift. JetBrains Mono loaded on demand.

---

### Type Scale — Size Tokens

| Token | CSS Variable | Size | Line Height | Usage |
|-------|-------------|------|-------------|-------|
| `text-xs` | `--text-xs` | 12px | 16px | Captions, timestamps, badges |
| `text-sm` | `--text-sm` | 14px | 20px | Labels, helper text, nav items |
| `text-base` | `--text-base` | 16px | 24px | Body text default |
| `text-lg` | `--text-lg` | 18px | 28px | Lead paragraphs, card descriptions |
| `text-xl` | `--text-xl` | 20px | 28px | Card titles, subheadings |
| `text-2xl` | `--text-2xl` | 24px | 32px | H3 headings, section subtitles |
| `text-3xl` | `--text-3xl` | 30px | 36px | H2 headings |
| `text-4xl` | `--text-4xl` | 36px | 40px | H1 headings, hero |
| `text-5xl` | `--text-5xl` | 48px | 48px | Display text, large KPIs |

---

### Semantic Type Roles

Use `.type-*` classes (defined in `tailwind.config.ts`) to apply complete typographic roles:

| Class | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `.type-h1` | 36px | 700 | 1.1 | -0.02em | Page titles, hero headlines |
| `.type-h2` | 30px | 700 | 1.2 | -0.015em | Section headings |
| `.type-h3` | 24px | 600 | 1.25 | -0.01em | Card titles, widget headings |
| `.type-h4` | 20px | 600 | 1.3 | -0.005em | Subsection headings |
| `.type-h5` | 18px | 600 | 1.4 | 0em | Modal titles, sidebar headings |
| `.type-h6` | 16px | 600 | 1.5 | 0em | Minor headings, table headers |
| `.type-body-lg` | 18px | 400 | 1.7 | 0em | Hero subheadings, lead text |
| `.type-body` | 16px | 400 | 1.6 | 0em | Standard body copy |
| `.type-body-sm` | 14px | 400 | 1.5 | 0em | Secondary content, footnotes |
| `.type-caption` | 12px | 400 | 1.4 | 0.01em | Timestamps, copyright, metadata |
| `.type-label` | 14px | 500 | 1.25 | 0.01em | Form labels, input hints |

---

### Font Weight Scale

| Token | Value | Usage |
|-------|-------|-------|
| `font-light` | 300 | Decorative large text |
| `font-normal` | 400 | Body copy |
| `font-medium` | 500 | Labels, nav items |
| `font-semibold` | 600 | H3-H6, card titles, buttons |
| `font-bold` | 700 | H1, H2, strong emphasis |

---

## Spacing System

**Base unit: 4px.** All spacing values are multiples of 4px.

| Token | Pixels | CSS Variable | Tailwind | Usage |
|-------|--------|-------------|----------|-------|
| 1 | 4px | — | `p-1` | Tight inline spacing |
| 2 | 8px | — | `p-2` | Icon-label gap |
| 3 | 12px | — | `p-3` | Small component padding |
| 4 | 16px | `--space-4` | `p-4` | **Default padding**, mobile gutters |
| 5 | 20px | — | `p-5` | Medium component padding |
| 6 | 24px | `--space-6` | `p-6` | Card padding |
| 8 | 32px | `--space-8` | `p-8` | Section spacing (mobile) |
| 10 | 40px | — | `p-10` | Large component padding |
| 12 | 48px | `--space-12` | `p-12` | Section padding (tablet) |
| 16 | 64px | `--space-16` | `p-16` | Section padding (desktop) |
| 20 | 80px | — | `p-20` | Large section margins |
| 24 | 96px | — | `p-24` | Hero padding |
| 32 | 128px | — | `p-32` | XL hero areas |

### Usage Patterns

```
Component internal padding:    p-4 (mobile), p-6 (desktop)
Between form elements:         gap-4 (16px)
Between sections:              mb-12 (mobile), mb-20 (desktop)
Grid gaps:                     gap-4 (mobile), gap-6 (desktop)
Button padding:                px-4 py-2 (sm), px-6 py-3 (md), px-8 py-4 (lg)
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-none` | 0px | Sharp corners (tables, code blocks) |
| `rounded-sm` | 2px | Subtle rounding (badges on tags) |
| `rounded` | 4px | Small components (inputs, small buttons) |
| `rounded-md` | 6px | Default buttons |
| `rounded-lg` | 8px | Cards, modals, dropdowns |
| `rounded-xl` | 12px | Large cards, panels |
| `rounded-2xl` | 16px | Featured cards, hero elements |
| `rounded-full` | 9999px | Pills, avatars, toggle switches |

---

## Shadows

| Token | CSS Value | Usage |
|-------|-----------|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Default card shadow |
| `shadow` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | Slightly raised cards |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Hover states, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals, popovers |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` | Elevated overlays |

---

## Z-Index Scale

| Name | Value | Usage |
|------|-------|-------|
| `z-base` | 0 | Normal document flow |
| `z-raised` | 10 | Slightly raised elements (sticky headers) |
| `z-dropdown` | 100 | Dropdown menus, select options |
| `z-sticky` | 200 | Sticky navbars and sidebars |
| `z-overlay` | 300 | Backdrop overlays |
| `z-modal` | 400 | Modal dialogs |
| `z-toast` | 500 | Toast notifications |
| `z-tooltip` | 600 | Tooltips (must appear above modals) |

---

## Focus Ring

All interactive elements use a consistent focus ring for keyboard accessibility.

**Specification:**
- Width: 2px
- Style: solid
- Color: `primary-600` (#7c3aed)
- Offset: 2px
- Border radius: matches element

**Tailwind implementation:**
```
focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2
```

**Dark mode:**
- Color: `primary-400` (#a78bfa)
- Ring offset background: `neutral-900`

---

## Animation Tokens

All animation values are defined as CSS custom properties in `styles/globals.css`:

| Variable | Value | Usage |
|----------|-------|-------|
| `--animation-button-press-duration` | 80ms | Button press transform |
| `--animation-button-hover-duration` | 150ms | Button hover bg transition |
| `--animation-page-fade-duration` | 150ms | Route change fade |
| `--animation-drawer-duration` | 200ms | Side drawer slide |
| `--animation-loading-skeleton-duration` | 1.5s | Skeleton shimmer loop |
| `--animation-loading-spinner-duration` | 400ms | Spinner rotation |
| `--animation-progress-fill-duration` | 240ms | Progress bar width fill |
| `--animation-confetti-duration` | 1.2s | Success confetti burst |
| `--animation-counter-increment-duration` | 700ms | Animated number counter |

**Easing reference:**
- `ease-out` — elements entering the screen
- `ease-in` — elements leaving the screen
- `ease-in-out` — continuous or looping animations
- `linear` — spinners, progress fills
- `cubic-bezier(0.4, 0, 0.2, 1)` — Material-style progress

---

## Dark Mode

The project uses the `class` strategy for dark mode (`dark` class on `<html>`).

### Dark Mode Color Mappings

| Light Token | Dark Equivalent | Notes |
|-------------|-----------------|-------|
| `white` bg | `neutral-900` | Page background |
| `neutral-50` | `neutral-900` | Card background |
| `neutral-100` | `neutral-800` | Hover backgrounds |
| `neutral-200` | `neutral-700` | Borders |
| `neutral-600` | `neutral-400` | Body text |
| `neutral-900` | `white` | Headings |
| `primary-600` | `primary-400` | Interactive elements |

### CSS Custom Properties (from `tokens.css`)

The token file auto-switches values in dark mode:
```css
:root {
  --color-bg: var(--color-neutral-50);
  --color-text: var(--color-neutral-900);
  --color-surface: white;
  --color-border: var(--color-neutral-200);
}

.dark {
  --color-bg: var(--color-neutral-900);
  --color-text: white;
  --color-surface: var(--color-neutral-800);
  --color-border: var(--color-neutral-700);
}
```

---

## Token Usage Examples

### React / Tailwind CSS

```jsx
// Color tokens
<div className="bg-primary-600 text-white">Primary</div>
<p className="text-neutral-600">Body text</p>
<span className="border-neutral-200">Card</span>

// Typography tokens
<h1 className="type-h1 text-neutral-900">Headline</h1>
<p className="type-body text-neutral-600">Body copy</p>
<label className="type-label text-neutral-700">Form label</label>

// Spacing tokens
<div className="p-6 mb-4 gap-4">Padded content</div>

// Dark mode
<div className="bg-white dark:bg-neutral-900">Surface</div>
```

### CSS Custom Properties

```css
.component {
  color: var(--color-primary-600);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  padding: var(--space-4);
  animation-duration: var(--animation-button-hover-duration);
}
```

---

## Token Audit

Run the token audit quarterly to ensure:
- [ ] All colors meet WCAG 2.1 AA contrast ratios
- [ ] No hardcoded hex values in component files
- [ ] Dark mode versions exist for all interactive tokens
- [ ] Animation durations respect prefers-reduced-motion
- [ ] New tokens added to both `tailwind.config.ts` AND `tokens.css`

---

*This document is generated from the source of truth in `tailwind.config.ts`. If tokens change there, update this document.*
