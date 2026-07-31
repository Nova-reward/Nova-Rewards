# Icon Guidelines — Nova Rewards

**Version:** 1.0  
**Library:** Heroicons  
**Last Updated:** 2026-07-23

---

## Icon Library

Nova Rewards uses **[Heroicons](https://heroicons.com/)** as the primary icon library.

- **Outline style** — UI chrome, navigation, buttons, form elements
- **Solid style** — Status indicators, filled states, emphasis

```bash
# Already installed
npm install @heroicons/react
```

```jsx
import { StarIcon } from '@heroicons/react/24/outline';    // Outline
import { StarIcon } from '@heroicons/react/24/solid';      // Solid
import { StarIcon } from '@heroicons/react/20/solid';      // 20px solid
```

---

## Icon Sizes

| Size | Usage | Heroicons Package | Tailwind |
|------|-------|------------------|----------|
| **16px** | Inline with text, badges | `@heroicons/react/16/solid` | `w-4 h-4` |
| **20px** | Default UI icons, buttons, inputs | `@heroicons/react/20/solid` | `w-5 h-5` |
| **24px** | Navigation, prominent actions | `@heroicons/react/24/outline` or `/solid` | `w-6 h-6` |
| **32px** | Feature cards, empty states | `@heroicons/react/24/outline` (scaled) | `w-8 h-8` |
| **48px** | Hero sections, large illustrative | Custom SVG | `w-12 h-12` |

### Size Selection Rules

- Use **16px** only inside compact components (badges, table cells)
- Use **20px** for all interactive elements (buttons with icons, inputs)
- Use **24px** for navigation items and standalone action icons
- Use **32px** for card decorations and section markers
- Use **48px** only in marketing/feature cards or empty states

---

## Icon + Label Spacing

When pairing icons with text:

| Context | Gap | Tailwind |
|---------|-----|----------|
| Button (sm) | 6px | `gap-1.5` |
| Button (md/lg) | 8px | `gap-2` |
| Navigation item | 12px | `gap-3` |
| Card header | 8px | `gap-2` |
| Inline with paragraph text | 4px | `gap-1` |

```jsx
// Correct — icon and label with proper gap
<button className="flex items-center gap-2">
  <PlusIcon className="w-5 h-5" aria-hidden="true" />
  <span>Add Campaign</span>
</button>

// Correct — icon aligned with text baseline
<p className="flex items-center gap-1 text-sm text-neutral-600">
  <CheckCircleIcon className="w-4 h-4 text-success-500 flex-shrink-0" aria-hidden="true" />
  Verified on Stellar
</p>
```

---

## Icon-Only Buttons

Icon-only buttons **must** have an accessible label:

```jsx
// ✅ Correct — aria-label on button
<button
  aria-label="Close modal"
  className="p-2 rounded-lg hover:bg-neutral-100 focus:ring-2 focus:ring-primary-600"
>
  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
</button>

// ✅ Correct — sr-only text for screen readers
<button className="p-2 rounded-lg hover:bg-neutral-100">
  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
  <span className="sr-only">Close modal</span>
</button>

// ❌ Wrong — no accessible label
<button>
  <XMarkIcon className="w-5 h-5" />
</button>
```

### Minimum Touch Target

Icon-only buttons must meet the 44×44px minimum touch target:

```jsx
// Use p-2.5 (10px padding) with w-6 h-6 icon = 44×44px total
<button className="p-2.5 rounded-lg">
  <XMarkIcon className="w-6 h-6" />
</button>

// Or min-w/h with explicit sizing
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <XMarkIcon className="w-5 h-5" />
</button>
```

---

## Accessibility Rules

### Decorative Icons

Icons that are purely visual (accompany visible text) must be hidden from assistive technology:

```jsx
// aria-hidden removes from accessibility tree
<CheckCircleIcon className="w-5 h-5 text-success-500" aria-hidden="true" />
<span>Transaction confirmed</span>
```

### Informative Icons

Icons that convey information without accompanying text need a text alternative:

```jsx
// Option 1: aria-label on the icon wrapper
<span role="img" aria-label="Warning">
  <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
</span>

// Option 2: sr-only adjacent text
<ExclamationTriangleIcon className="w-5 h-5 text-warning-500" aria-hidden="true" />
<span className="sr-only">Warning:</span>

// Option 3: title element in SVG (for standalone SVG)
<svg aria-labelledby="icon-title">
  <title id="icon-title">Warning indicator</title>
  <!-- path data -->
</svg>
```

### Status Icons

Always pair status icons with text, never rely on color or icon alone:

```jsx
// ✅ Correct — icon + text + color
<span className="flex items-center gap-1 text-success-600 text-sm font-medium">
  <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
  Active
</span>

// ❌ Wrong — icon alone to indicate status
<CheckCircleIcon className="w-5 h-5 text-success-500" />
```

---

## Icon Color Usage

### Inherit from Text Color (Preferred)

```jsx
// Icon inherits parent text color automatically
<button className="text-primary-600 hover:text-primary-700 flex items-center gap-2">
  <PlusIcon className="w-5 h-5" aria-hidden="true" />
  Add Item
</button>
```

### Explicit Color

Use explicit color when the icon color differs from adjacent text:

```jsx
// Status icon with semantic color
<span className="flex items-center gap-2 text-neutral-700">
  <ExclamationCircleIcon className="w-5 h-5 text-warning-500 flex-shrink-0" aria-hidden="true" />
  This action requires approval
</span>
```

### Color Rules

| Context | Icon Color |
|---------|-----------|
| Navigation (active) | `text-primary-600` |
| Navigation (inactive) | `text-neutral-400` |
| Success indicator | `text-success-500` |
| Warning indicator | `text-warning-500` |
| Error indicator | `text-error-500` |
| Info indicator | `text-info-500` |
| Disabled state | `text-neutral-300` |
| Button icon (inherits) | `currentColor` |

---

## Custom Nova Icons

These icons are specific to the Nova Rewards brand and are not in Heroicons. Store them in `public/icons/` as SVG and create React wrappers in `components/icons/`.

### NOVA Token Coin

Represents the NOVA token currency. Used in:
- Balance displays
- Reward amounts
- Token metrics

```jsx
// components/icons/NovaTokenIcon.jsx
export function NovaTokenIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Circle background */}
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" />
      {/* "N" letterform */}
      <path
        d="M8 16V8l8 8V8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

### Staking Lightning Bolt

Represents staking activity and APY. Used in:
- Staking section headers
- Staking reward badges
- Staking-related notifications

```jsx
// Use BoltIcon from Heroicons with primary-600 color
import { BoltIcon } from '@heroicons/react/24/solid';

<BoltIcon className="w-6 h-6 text-primary-600" aria-hidden="true" />
```

### Referral Chain Link

Represents the referral program. Used in:
- Referral section headers
- Referral count badges
- Share prompts

```jsx
// Use LinkIcon from Heroicons
import { LinkIcon } from '@heroicons/react/24/outline';

<LinkIcon className="w-6 h-6 text-secondary-600" aria-hidden="true" />
```

---

## Recommended Icon Mapping

| Feature | Icon | Style | Import |
|---------|------|-------|--------|
| Dashboard | `HomeIcon` | Outline (inactive) / Solid (active) | `@heroicons/react/24/outline` |
| Rewards | `StarIcon` | Outline / Solid | `@heroicons/react/24/outline` |
| Campaigns | `MegaphoneIcon` | Outline | `@heroicons/react/24/outline` |
| Staking | `BoltIcon` | Solid | `@heroicons/react/24/solid` |
| Profile | `UserCircleIcon` | Outline | `@heroicons/react/24/outline` |
| Settings | `Cog6ToothIcon` | Outline | `@heroicons/react/24/outline` |
| Wallet | `WalletIcon` | Outline | `@heroicons/react/24/outline` |
| Transaction | `ArrowsRightLeftIcon` | Outline | `@heroicons/react/24/outline` |
| Copy | `ClipboardIcon` / `ClipboardDocumentCheckIcon` | Outline | `@heroicons/react/24/outline` |
| External link | `ArrowTopRightOnSquareIcon` | Outline (16px) | `@heroicons/react/16/solid` |
| Close / X | `XMarkIcon` | Solid | `@heroicons/react/20/solid` |
| Check | `CheckIcon` / `CheckCircleIcon` | Solid | `@heroicons/react/20/solid` |
| Warning | `ExclamationTriangleIcon` | Solid | `@heroicons/react/24/solid` |
| Error | `ExclamationCircleIcon` | Solid | `@heroicons/react/24/solid` |
| Info | `InformationCircleIcon` | Solid | `@heroicons/react/24/solid` |
| Sort | `ChevronUpDownIcon` | Solid (16px) | `@heroicons/react/16/solid` |
| Expand | `ChevronDownIcon` | Solid | `@heroicons/react/20/solid` |
| Search | `MagnifyingGlassIcon` | Outline | `@heroicons/react/24/outline` |
| Filter | `FunnelIcon` | Outline | `@heroicons/react/24/outline` |
| Notification | `BellIcon` | Outline / Solid (has-unread) | `@heroicons/react/24/outline` |
| Download | `ArrowDownTrayIcon` | Outline | `@heroicons/react/24/outline` |
| Upload | `ArrowUpTrayIcon` | Outline | `@heroicons/react/24/outline` |
| Share | `ShareIcon` | Outline | `@heroicons/react/24/outline` |
| Refresh | `ArrowPathIcon` | Outline | `@heroicons/react/24/outline` |
| Calendar | `CalendarDaysIcon` | Outline | `@heroicons/react/24/outline` |
| Clock | `ClockIcon` | Outline | `@heroicons/react/24/outline` |
| Lock | `LockClosedIcon` | Solid | `@heroicons/react/24/solid` |
| Eye (show) | `EyeIcon` | Outline | `@heroicons/react/24/outline` |
| Eye off (hide) | `EyeSlashIcon` | Outline | `@heroicons/react/24/outline` |

---

## Icon Do's and Don'ts

### ✅ Do

- Always pair icons with text labels in primary actions
- Use `aria-hidden="true"` on decorative icons
- Use `aria-label` or `sr-only` text for icon-only buttons
- Keep icon sizes consistent within the same component type
- Use `flex-shrink-0` to prevent icons from shrinking in flex containers
- Match icon style (outline vs solid) consistently within a context

### ❌ Don't

- Don't use icons as the sole indicator of meaning (always back with text or ARIA)
- Don't use different icon sizes in the same navigation or list
- Don't use raster (PNG/JPEG) icons — SVG only
- Don't mix Heroicons with other icon libraries without documenting it
- Don't scale icons beyond their intended size (use the correct px variant)
- Don't override icon `fill` or `stroke` directly — use `text-` color utilities

---

## Icon QA Checklist

Before shipping a new icon implementation:

- [ ] Icon is the correct size for its context
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Icon-only buttons have accessible label
- [ ] Icon color meets 3:1 contrast ratio against background
- [ ] Icon does not scale below minimum (16px)
- [ ] Touch target is minimum 44×44px for interactive icons
- [ ] Dark mode color is correct
