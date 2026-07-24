# Animation System — Nova Rewards

**Version:** 1.0 | **Last Updated:** 2026-07-23

---

## Principles

1. **Purposeful** — every animation communicates a state change or guides attention
2. **Performance** — use only `transform` and `opacity` (compositor-thread, no layout thrash)
3. **Accessible** — all animations respect `prefers-reduced-motion: reduce`
4. **Consistent** — use the duration/easing scale below
5. **Subtle** — UI chrome ≤ 200ms; celebrations allowed to be longer

---

## Duration Scale

| Name | Duration | Usage |
|------|----------|-------|
| `instant` | 0ms | No transition (immediate feedback) |
| `fast` | 100ms | Button press, icon swap |
| `normal` | 200ms | Modals, drawers, dropdowns |
| `slow` | 300ms | Page transitions |
| `slower` | 500ms | Complex orchestrations |
| `celebration` | 1200ms | Confetti, success bursts |

CSS vars (in `globals.css`):
```css
--animation-loading-skeleton-duration: 1.5s;
--animation-loading-spinner-duration: 400ms;
--animation-progress-fill-duration: 240ms;
--animation-confetti-duration: 1.2s;
```

---

## Easing Functions

| Name | Value | Use for |
|------|-------|---------|
| `ease-out` | `cubic-bezier(0,0,0.2,1)` | Elements entering the screen |
| `ease-in` | `cubic-bezier(0.4,0,1,1)` | Elements leaving the screen |
| `ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | Continuous / looping animations |
| `spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Badges, toggles, playful elements |
| `linear` | `linear` | Spinners, shimmer, progress |

---

## Page Transitions

| Transition | Enter | Exit | Duration |
|------------|-------|------|----------|
| Route fade | `opacity: 0→1` | `opacity: 1→0` | 150ms ease-out / ease-in |
| Modal open | `scale(0.95)+opacity(0)→scale(1)+opacity(1)` | reverse | 200ms / 150ms |
| Drawer slide | `translateX(100%)→translateX(0)` | reverse | 200ms ease-out |
| Tab switch | cross-fade opacity | — | 150ms |
| Mobile slide-up | `translateY(20px)+opacity(0)→translateY(0)+opacity(1)` | reverse | 200ms |

---

## Micro-interactions

| Element | Animation | Duration |
|---------|-----------|----------|
| Button press | `scale(0.97)` | 80ms ease-out |
| Button hover | background-color | 150ms ease-out |
| Input focus | border-color + ring | 150ms ease-out |
| Card hover | `translateY(-2px)` + shadow | 200ms ease-out |
| Toggle switch | `translateX()` | 200ms ease-in-out |
| Checkbox check | `scale(0→1)` | 150ms spring |
| Badge appear | `scale(0→1)` | 200ms spring |
| Link hover | underline slide-in | 150ms |
| Notification dot | `scale(0→1)` pulse | 300ms spring |

---

## Loading Animations

| Animation | Spec |
|-----------|------|
| Skeleton shimmer | `translateX(-100%→200%)` 1.5s linear infinite |
| Spinner | `rotate(0→360deg)` 400ms linear infinite |
| Progress bar | `width` 240ms `cubic-bezier(0.4,0,0.2,1)` |
| Dot loader | stagger `opacity(0→1→0)` 600ms infinite, 150ms delay each |

---

## Feedback Animations

| Event | Animation |
|-------|-----------|
| Success | Confetti burst (1.2s ease-out) + checkmark stroke-draw (300ms) |
| Error | Shake: `translateX(-8,8,-4,4,0)px` 400ms ease-in-out |
| Toast enter | `translateY(-100%→0)` 200ms ease-out |
| Toast exit | `translateY(0→-100%)` 150ms ease-in |
| Copy success | Icon swap + scale pulse 200ms |
| Points earned | Counter increment 700ms spring |

---

## Performance Guidelines

- **Never animate:** `width`, `height`, `top`, `left`, `margin`, `padding`, `border-width`
- **Always animate:** `transform`, `opacity`
- `will-change: transform` only immediately before animation; remove after
- Target **60fps on Pixel 4a** (mid-range Android baseline)
- Prefer **CSS animations** over JS for simple transitions
- Use **Framer Motion** only for complex orchestrated sequences
- Audit with Chrome DevTools → Performance → Rendering → FPS meter

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Acceptable in reduced motion: **opacity-only** crossfades (they don't cause vestibular issues).  
Never disable ALL feedback — error shake should become a color change instead.

---

## CSS Implementation

See `novaRewards/frontend/styles/animations.css` for all `@keyframes` and utility classes.  
See `novaRewards/frontend/hooks/useReducedMotion.js` for the React hook.
