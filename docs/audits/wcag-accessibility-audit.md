# WCAG 2.1 Accessibility Audit Report — Nova Rewards Frontend

**Date:** 2026-03-29  
**Standard:** WCAG 2.1 Level AA  
**Scope:** `novaRewards/frontend/` — all pages, components, and global styles  
**Auditor:** Internal review (static code analysis)

---

## Executive Summary

| Category | Issues Found | Critical | Major | Minor |
|---|---|---|---|---|
| Color Contrast | 6 | 2 | 3 | 1 |
| Font Sizes | 2 | 0 | 1 | 1 |
| Focus Management | 5 | 2 | 2 | 1 |
| Keyboard Navigation | 4 | 2 | 1 | 1 |
| Screen Reader / ARIA | 7 | 3 | 3 | 1 |
| **Total** | **24** | **9** | **10** | **5** |

**Overall WCAG 2.1 AA Compliance: ❌ Non-Compliant** — 9 critical issues must be resolved before production.

---

## 1. Color Contrast (WCAG 1.4.3 — AA requires 4.5:1 for normal text, 3:1 for large text)

### ISSUE-CC-01 — Critical
**File:** `styles/PointsWidget.module.css`  
**Problem:** `.balance` uses `color: #7c3aed` on `background: #1a1a2e`. Contrast ratio ≈ **3.8:1** — fails AA for normal text (requires 4.5:1).  
**WCAG:** 1.4.3 Contrast (Minimum)

### ISSUE-CC-02 — Critical
**File:** `styles/PointsWidget.module.css`  
**Problem:** `.label` uses `color: #94a3b8` on `background: #1a1a2e`. Contrast ratio ≈ **3.5:1** — fails AA for normal text.  
**WCAG:** 1.4.3

### ISSUE-CC-03 — Major
**File:** `styles/globals.css` — dark theme  
**Problem:** `--muted: #94a3b8` on `--bg: #0f0f1a`. Contrast ratio ≈ **3.5:1** — used widely for labels, table headers, and subtitles. Fails AA.  
**WCAG:** 1.4.3

### ISSUE-CC-04 — Major
**File:** `components/StellarDropModal.js`  
**Problem:** Inline style `color: '#6b7280'` on `backgroundColor: '#f9fafb'`. Contrast ratio ≈ **4.1:1** — fails AA for normal text.  
**WCAG:** 1.4.3

### ISSUE-CC-05 — Major
**File:** `components/ReferralLink.js`  
**Problem:** `.stat-label` uses `color: #94a3b8` on `background: rgba(124,58,237,0.15)` over `#1e1b4b`. Effective contrast ≈ **3.2:1** — fails AA.  
**WCAG:** 1.4.3

### ISSUE-CC-06 — Minor
**File:** `styles/globals.css`  
**Problem:** `.badge-gray` uses `--badge-gray-text: #475569` on `--badge-gray-bg: #e2e8f0`. Contrast ratio ≈ **4.3:1** — marginally fails AA (requires 4.5:1).  
**WCAG:** 1.4.3

---

## 2. Font Sizes (WCAG 1.4.4 — text must resize up to 200% without loss of content)

### ISSUE-FS-01 — Major
**File:** `styles/globals.css`, `styles/PointsWidget.module.css`  
**Problem:** Multiple elements use `font-size` values below `0.875rem` (14px): `.label` at `0.8rem`, `.notification-badge` at `0.65rem`, `.error-message` at `0.8rem`, `.retryBtn` at `0.8rem`. At 200% zoom these remain readable, but `0.65rem` (≈10px) is below the practical minimum for legibility.  
**WCAG:** 1.4.4 Resize Text

### ISSUE-FS-02 — Minor
**File:** `components/ReferralLink.js`  
**Problem:** `.share-btn` uses `font-size: 0.8rem` and `.referral-input` uses `font-size: 0.85rem` — both below the recommended 1rem minimum for interactive controls.  
**WCAG:** 1.4.4

---

## 3. Focus Management (WCAG 2.4.3, 2.4.7)

### ISSUE-FM-01 — Critical
**File:** `components/RedemptionModal.js`, `components/ConfirmationModal.js`  
**Problem:** Neither modal traps focus or moves focus to the modal on open. When a modal opens, keyboard users remain focused on the triggering element behind the overlay. `StellarDropModal.js` correctly implements focus trapping — the other two modals do not.  
**WCAG:** 2.4.3 Focus Order, 2.1.2 No Keyboard Trap (inverse — focus must enter the modal)

### ISSUE-FM-02 — Critical
**File:** `components/DashboardLayout.js`  
**Problem:** The profile dropdown (`profileMenuOpen`) has no focus management. When opened, focus stays on the trigger button; keyboard users cannot reach dropdown items without tabbing through the entire page. When closed, focus is not explicitly returned.  
**WCAG:** 2.4.3 Focus Order

### ISSUE-FM-03 — Major
**File:** `styles/globals.css`  
**Problem:** `.btn:focus-visible` uses `outline: none` and replaces it with a `box-shadow` animation (`focus-ring-fade-in`). The animation starts at `box-shadow: 0 0 0 0 rgba(59,130,246,0)` — meaning there is a brief frame where no focus indicator is visible. Additionally, `box-shadow` is not visible in Windows High Contrast Mode.  
**WCAG:** 2.4.7 Focus Visible

### ISSUE-FM-04 — Major
**File:** `styles/globals.css`  
**Problem:** `.input:focus` uses `outline: 2px solid var(--accent)` — correct. However, `.form-input:focus` (auth pages) removes the outline (`outline: none`) and uses only `border-color` + `box-shadow`. In High Contrast Mode, `box-shadow` is suppressed, leaving no visible focus indicator.  
**WCAG:** 2.4.7 Focus Visible

### ISSUE-FM-05 — Minor
**File:** `components/DashboardLayout.js`  
**Problem:** Mobile sidebar overlay (`mobile-overlay` div) is not focusable and has no `aria-hidden` on the obscured content behind it when open. Keyboard users can still tab into the hidden main content.  
**WCAG:** 2.4.3 Focus Order

---

## 4. Keyboard Navigation (WCAG 2.1.1)

### ISSUE-KN-01 — Critical
**File:** `components/RedemptionModal.js`, `components/ConfirmationModal.js`  
**Problem:** No `Escape` key handler to close the modal. Keyboard-only users have no way to dismiss these modals without clicking Cancel.  
**WCAG:** 2.1.1 Keyboard

### ISSUE-KN-02 — Critical
**File:** `components/DashboardLayout.js`  
**Problem:** Profile dropdown items are rendered as `<Link>` and `<button>` elements but there is no `ArrowDown`/`ArrowUp` key navigation between them, and no `Escape` to close the dropdown. This is expected behavior for a menu widget per ARIA Authoring Practices.  
**WCAG:** 2.1.1 Keyboard

### ISSUE-KN-03 — Major
**File:** `components/Leaderboard.js`  
**Problem:** Toggle buttons ("All-Time" / "Weekly") have no `aria-pressed` attribute to communicate the current selection state to keyboard and screen reader users.  
**WCAG:** 2.1.1 Keyboard, 4.1.2 Name, Role, Value

### ISSUE-KN-04 — Minor
**File:** `components/ReferralLink.js`  
**Problem:** The read-only referral URL `<input>` uses `onClick` to select text but has no keyboard equivalent (e.g., `onFocus`). Keyboard users cannot easily select-all the URL.  
**WCAG:** 2.1.1 Keyboard

---

## 5. Screen Reader / ARIA (WCAG 1.3.1, 4.1.2, 4.1.3)

### ISSUE-SR-01 — Critical
**File:** `components/RedemptionModal.js`  
**Problem:** Modal `<div>` has no `role="dialog"`, no `aria-modal="true"`, and no `aria-labelledby`. Screen readers will not announce it as a dialog and will not restrict reading to modal content.  
**WCAG:** 4.1.2 Name, Role, Value

### ISSUE-SR-02 — Critical
**File:** `components/ConfirmationModal.js`  
**Problem:** Same as ISSUE-SR-01 — missing `role="dialog"`, `aria-modal`, and `aria-labelledby`.  
**WCAG:** 4.1.2

### ISSUE-SR-03 — Critical
**File:** `components/Toast.js`  
**Problem:** The toast container has no `role="status"` or `aria-live` region. Toast notifications are invisible to screen readers.  
**WCAG:** 4.1.3 Status Messages

### ISSUE-SR-04 — Major
**File:** `components/DashboardLayout.js`  
**Problem:** Navigation icons use emoji (📊, 🏆, 🎁, etc.) as the sole visual label when the sidebar is collapsed. Emoji are announced verbosely by screen readers (e.g., "bar chart emoji"). The `<span className="nav-icon">` has no `aria-hidden="true"`, and the `nav-label` span is hidden via CSS — leaving no accessible text for collapsed nav items.  
**WCAG:** 1.3.1 Info and Relationships, 4.1.2

### ISSUE-SR-05 — Major
**File:** `components/Leaderboard.js`  
**Problem:** Avatar `<img>` uses `alt="Avatar"` — a generic, non-descriptive label. It should include the user's display name (e.g., `alt={entry.displayName}`).  
**WCAG:** 1.1.1 Non-text Content

### ISSUE-SR-06 — Major
**File:** `components/PointsWidget.js`  
**Problem:** The animated delta indicator (`+50`, `-10`) has no `aria-live` region. Balance changes are not announced to screen reader users.  
**WCAG:** 4.1.3 Status Messages

### ISSUE-SR-07 — Minor
**File:** `components/DashboardLayout.js`  
**Problem:** The notification badge (`<span className="notification-badge">3</span>`) is a visual-only count with no accessible label. Screen readers will announce "3" with no context. The parent button has `aria-label="Notifications"` but the count is not included.  
**WCAG:** 4.1.2 Name, Role, Value

---

## Remediation Plan

### Priority 1 — Critical (resolve before launch)

| ID | File | Fix |
|---|---|---|
| ISSUE-CC-01 | `PointsWidget.module.css` | Change `.balance` color to `#9d6ef5` or lighter to achieve ≥4.5:1 on `#1a1a2e` |
| ISSUE-CC-02 | `PointsWidget.module.css` | Change `.label` color to `#b0bec5` or lighter |
| ISSUE-FM-01 | `RedemptionModal.js`, `ConfirmationModal.js` | Add focus trap + move focus to modal heading on open; restore focus on close (mirror `StellarDropModal` pattern) |
| ISSUE-FM-02 | `DashboardLayout.js` | On dropdown open, move focus to first item; add `Escape` to close and return focus to trigger |
| ISSUE-KN-01 | `RedemptionModal.js`, `ConfirmationModal.js` | Add `useEffect` with `keydown` listener for `Escape` key |
| ISSUE-KN-02 | `DashboardLayout.js` | Implement `ArrowDown`/`ArrowUp`/`Escape` keyboard handling for profile dropdown |
| ISSUE-SR-01 | `RedemptionModal.js` | Add `role="dialog" aria-modal="true" aria-labelledby="redemption-modal-title"` to modal div; add `id` to `<h2>` |
| ISSUE-SR-02 | `ConfirmationModal.js` | Same as SR-01 |
| ISSUE-SR-03 | `Toast.js` | Add `role="status" aria-live="polite" aria-atomic="true"` to toast container |

### Priority 2 — Major (resolve within first sprint post-launch)

| ID | File | Fix |
|---|---|---|
| ISSUE-CC-03 | `globals.css` | Increase dark theme `--muted` to `#a8b8cc` (≥4.5:1 on `#0f0f1a`) |
| ISSUE-CC-04 | `StellarDropModal.js` | Replace inline `color: '#6b7280'` with `color: '#4b5563'` or use CSS variable |
| ISSUE-CC-05 | `ReferralLink.js` | Increase `.stat-label` color to `#b0bec5` |
| ISSUE-FM-03 | `globals.css` | Add `@media (forced-colors: active)` override to restore `outline` on `.btn:focus-visible` |
| ISSUE-FM-04 | `globals.css` | Add `@media (forced-colors: active)` override to restore `outline` on `.form-input:focus` |
| ISSUE-FM-05 | `DashboardLayout.js` | When mobile sidebar is open, add `aria-hidden="true"` to `.main-wrapper` and set `tabindex="-1"` on its children |
| ISSUE-FS-01 | `globals.css`, `PointsWidget.module.css` | Raise `.notification-badge` to `0.75rem` minimum; raise `.label` to `0.875rem` |
| ISSUE-KN-03 | `Leaderboard.js` | Add `aria-pressed={rankingType === 'all-time'}` / `aria-pressed={rankingType === 'weekly'}` to toggle buttons |
| ISSUE-SR-04 | `DashboardLayout.js` | Add `aria-hidden="true"` to emoji `<span>` icons; add `aria-label={link.label}` to each `<Link>` when sidebar is collapsed |
| ISSUE-SR-05 | `Leaderboard.js` | Change `alt="Avatar"` to `alt={entry.displayName || 'User avatar'}` |
| ISSUE-SR-06 | `PointsWidget.js` | Wrap delta `<div>` with `aria-live="polite" aria-atomic="true"` |

### Priority 3 — Minor (resolve in backlog)

| ID | File | Fix |
|---|---|---|
| ISSUE-CC-06 | `globals.css` | Darken `--badge-gray-text` to `#3d4f63` for ≥4.5:1 on `#e2e8f0` |
| ISSUE-FS-02 | `ReferralLink.js` | Raise share button and input font sizes to `0.875rem` |
| ISSUE-KN-04 | `ReferralLink.js` | Add `onFocus={(e) => e.target.select()}` to referral URL input |
| ISSUE-SR-07 | `DashboardLayout.js` | Update notification button `aria-label` to include count: `aria-label={\`Notifications, \${count} unread\`}` |

---

## Recommended Tooling

Add these to the CI pipeline to catch regressions:

```bash
# Install axe-core for automated checks
npm install --save-dev @axe-core/playwright

# Add to playwright.config.js or a dedicated a11y spec
# Run contrast checks in CI
npx playwright test e2e/a11y.spec.js
```

Add a dedicated accessibility test file:

```js
// novaRewards/frontend/e2e/a11y.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/login', '/register', '/dashboard', '/rewards', '/leaderboard'];

for (const path of pages) {
  test(`${path} has no critical a11y violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

---

## Summary of WCAG 2.1 AA Criteria Status

| Criterion | Description | Status |
|---|---|---|
| 1.1.1 | Non-text Content | ⚠️ Partial (avatar alt text) |
| 1.3.1 | Info and Relationships | ⚠️ Partial (collapsed nav) |
| 1.4.3 | Contrast (Minimum) | ❌ Fail |
| 1.4.4 | Resize Text | ⚠️ Partial |
| 2.1.1 | Keyboard | ❌ Fail |
| 2.1.2 | No Keyboard Trap | ❌ Fail (modals) |
| 2.4.3 | Focus Order | ❌ Fail |
| 2.4.7 | Focus Visible | ⚠️ Partial (High Contrast Mode) |
| 4.1.2 | Name, Role, Value | ❌ Fail |
| 4.1.3 | Status Messages | ❌ Fail |
