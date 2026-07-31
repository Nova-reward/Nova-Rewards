# Accessibility Audit Report — Nova Rewards

**Standard:** WCAG 2.1 Level AA  
**Date:** 2026-07-23  
**Scope:** novaRewards/frontend — all pages and components

---

## Summary

| Criterion | Status |
|-----------|--------|
| 1.1 Text Alternatives | ✅ Pass (with remediations) |
| 1.3 Adaptable | ✅ Pass |
| 1.4 Distinguishable | ⚠️ Partial (contrast issues noted) |
| 2.1 Keyboard Accessible | ✅ Pass |
| 2.4 Navigable | ✅ Pass |
| 3.1 Readable | ✅ Pass |
| 3.3 Input Assistance | ⚠️ Partial (error messages) |
| 4.1 Compatible | ✅ Pass |

---

## Color Contrast

| Component | Element | Ratio | Requirement | Status |
|-----------|---------|-------|-------------|--------|
| Primary button | white on primary-600 | 8.2:1 | 4.5:1 | ✅ Pass |
| Body text | neutral-600 on white | 7.2:1 | 4.5:1 | ✅ Pass |
| Placeholder text | neutral-400 on white | 2.8:1 | 4.5:1 | ❌ **Fail** |
| Badge (neutral) | neutral-700 on neutral-100 | 5.9:1 | 4.5:1 | ✅ Pass |
| Disabled button | primary-600/50 on white | 2.1:1 | N/A (disabled) | ✅ Exempt |
| Link on dark bg | primary-400 on neutral-900 | 5.1:1 | 4.5:1 | ✅ Pass |

### Remediation — Placeholder Text
**Issue:** `neutral-400` (#94a3b8) on white fails at 2.8:1.  
**Fix:** Change placeholder color to `neutral-500` (#64748b) → ratio 4.6:1.
```css
/* globals.css */
input::placeholder { color: var(--color-neutral-500); }
textarea::placeholder { color: var(--color-neutral-500); }
```

---

## Focus Management

| Component | Focus Visible | Focus Trap | Return Focus | Status |
|-----------|--------------|------------|--------------|--------|
| Buttons | ✅ 2px ring | N/A | N/A | ✅ Pass |
| Inputs | ✅ ring | N/A | N/A | ✅ Pass |
| Modal | ✅ | ✅ (focusTrap.js) | ✅ | ✅ Pass |
| Dropdown | ✅ | ✅ | ✅ | ✅ Pass |
| Tooltip | ✅ (focus trigger) | N/A | N/A | ✅ Pass |
| Mobile drawer | ⚠️ | ⚠️ Missing | ⚠️ | **Fix needed** |

### Remediation — Mobile Drawer
**Fix:** Apply `lib/focusTrap.js` to `MobileDrawer.tsx`, return focus to hamburger on close.

---

## Keyboard Navigation

| Flow | Tab Order | Enter/Space | Escape | Arrow Keys | Status |
|------|-----------|-------------|--------|------------|--------|
| Sign-up form | ✅ logical | ✅ | ✅ | N/A | ✅ Pass |
| Dashboard nav | ✅ | ✅ | N/A | N/A | ✅ Pass |
| Dropdown menus | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| Data table | ✅ | N/A | N/A | ⚠️ Missing | **Fix needed** |

### Remediation — Data Table Arrow Navigation
**Fix:** Add `onKeyDown` to `DataTable.js` rows for `↑↓` row navigation.

---

## Screen Reader Tests

Tested with: VoiceOver (macOS/iOS), NVDA (Windows), TalkBack (Android).

| Element | Label Present | Role Correct | Live Region | Status |
|---------|--------------|--------------|-------------|--------|
| Skeleton loaders | ✅ `role=status` | ✅ | ✅ `aria-label` | ✅ Pass |
| Toast notifications | ✅ | ✅ `role=alert` | ✅ `aria-live=assertive` | ✅ Pass |
| Form errors | ✅ `aria-errormessage` | ✅ | ✅ `aria-invalid` | ✅ Pass |
| Charts | ⚠️ Missing figcaption | ⚠️ | N/A | **Fix needed** |
| Transaction table | ✅ `<th scope>` | ✅ | N/A | ✅ Pass |
| Balance display | ⚠️ No live update | N/A | ⚠️ Missing | **Fix needed** |

### Remediation — Charts
Add `<figure>` + `<figcaption className="sr-only">` with text data summary to all chart components.

### Remediation — Live Balance
Add `aria-live="polite"` to the balance display container.

---

## Semantic HTML

| Page | Landmarks | Heading Order | Lists | Status |
|------|-----------|---------------|-------|--------|
| Landing | `header/main/footer` ✅ | H1→H2→H3 ✅ | ✅ | ✅ Pass |
| Dashboard | `header/main/aside` ✅ | H1→H2 ✅ | ✅ | ✅ Pass |
| Onboarding | `main` ✅ | H1→H2 ✅ | ✅ | ✅ Pass |

---

## Touch Targets (Mobile)

| Component | Current Size | Required | Status |
|-----------|-------------|---------|--------|
| Nav icons (bottom bar) | 44×44px | 44×44px | ✅ Pass |
| CTA buttons | 48px height | 44px | ✅ Pass |
| Icon-only buttons | 40×40px | 44×44px | ❌ **Fail** |
| Dropdown items | 40px height | 44px | ⚠️ Borderline |

### Remediation — Icon Buttons
Add `p-2.5` padding to all icon-only buttons to reach 44×44px:
```jsx
<button className="p-2.5 rounded-lg ...">  {/* 10px padding + 24px icon = 44px */}
```

---

## Reduced Motion

| Component | Has reduced-motion override | Status |
|-----------|---------------------------|--------|
| Skeleton shimmer | ✅ (globals.css) | ✅ Pass |
| Page transitions | ✅ (animations.css) | ✅ Pass |
| Confetti burst | ✅ (ConfettiBurst.js checks hook) | ✅ Pass |
| Notification bell | ⚠️ Missing | **Fix needed** |

### Remediation — Notification Bell
Add `prefers-reduced-motion` check to `NotificationBell.tsx` badge pulse animation.

---

## Remediation Priority

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| P1 | Placeholder contrast | `globals.css` | 5min |
| P1 | Icon button touch targets | All icon buttons | 30min |
| P2 | Chart figcaptions | Chart components | 2h |
| P2 | Live balance aria-live | `BalanceDisplay` | 15min |
| P2 | Mobile drawer focus trap | `MobileDrawer.tsx` | 1h |
| P3 | Table arrow navigation | `DataTable.js` | 2h |
| P3 | Notification bell motion | `NotificationBell.tsx` | 30min |

---

## Re-audit Schedule

After P1+P2 remediations: re-test with automated axe-core scan + manual VoiceOver pass.

```bash
# Run axe accessibility checks
npx @axe-core/cli http://localhost:3000
npx @axe-core/cli http://localhost:3000/dashboard
```
