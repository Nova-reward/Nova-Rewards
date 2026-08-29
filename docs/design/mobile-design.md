# Mobile Design — Nova Rewards

**Last Updated:** 2026-07-23  
**Approach:** Mobile-first (design for 375px, scale up)

---

## Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| xs | 375px | 1 col, bottom nav |
| sm | 640px | 1-2 col, bottom nav |
| md | 768px | 2-4 col, icon sidebar |
| lg | 1024px+ | 4 col, full sidebar |

---

## Mobile Navigation

Bottom navigation bar — 5 tabs:

```
┌─────────────────────────────────────────────┐
│  [🏠]    [⭐]    [📢]    [⚡]    [👤]      │
│  Home   Rewards  Camps  Stake  Profile      │
│  64px height + env(safe-area-inset-bottom)  │
└─────────────────────────────────────────────┘
```

- Active tab: icon + label in `primary-600`
- Inactive: icon + label in `neutral-400`
- Notification dot: `error-500` 8px circle on Campaigns icon
- Background: `white`, `border-top: 1px solid neutral-200`
- Safe area: `padding-bottom: env(safe-area-inset-bottom)`

---

## Touch Interactions

| Interaction | Spec |
|-------------|------|
| Min touch target | 44×44px |
| Tap feedback | `scale(0.97)` 80ms |
| Swipe to dismiss | Toast, drawer (velocity threshold 0.5) |
| Swipe to refresh | Pull-to-refresh on lists (64px threshold) |
| Long press | Context menu on reward cards |
| Pinch to zoom | Disabled on dashboard (use date picker instead) |

---

## Mobile-First Component Rules

### Cards
- Full-width on mobile (no grid gaps, edge-to-edge with `mx-0`)
- Or 16px margin each side (`mx-4`)
- Horizontal scroll for card rows: `flex overflow-x-auto snap-x snap-mandatory`
- Each card: `snap-start flex-shrink-0 w-[85vw]`

### Forms
- Full-width inputs (`w-full`)
- Label always above (never inline on mobile)
- Large touch targets: min `h-12` (48px) for inputs
- Numeric keyboard: `inputMode="numeric"` for amounts
- Prevent zoom on focus: `font-size: 16px` on all inputs (prevents iOS zoom)

### Modals
- Full-screen on mobile (< 640px): `fixed inset-0`
- Sheet-style from bottom: `fixed bottom-0 inset-x-0 rounded-t-2xl`
- Handle bar indicator: `w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-3 mb-4`
- Dismiss: swipe down or tap outside

### Tables → Lists
- Data tables convert to stacked card lists on mobile
- Each row becomes a card with label: value pairs
- Sort/filter moves to a modal sheet (tap filter icon → sheet from bottom)

---

## iOS-Specific Patterns

- Safe area insets for notch/home indicator via `env(safe-area-inset-*)`
- Status bar: light content (white icons) on `primary-600` header backgrounds
- Haptic feedback via `navigator.vibrate(10)` on confirm actions (Android only; iOS requires native)
- Prevent overscroll bounce: `overscroll-behavior: none` on main scroll container

---

## Performance Targets (Mobile)

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s on 4G |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Bundle size (initial JS) | < 200KB gzipped |
| Images | WebP format, lazy loaded, `sizes` attribute |

---

## Mobile Accessibility

- Zoom enabled (never `user-scalable=no`)
- Font size min 16px for inputs (prevents iOS zoom)
- All interactive elements 44×44px minimum
- `autocomplete` attributes on form fields
- `autocorrect="off" autocapitalize="none"` on wallet address inputs
