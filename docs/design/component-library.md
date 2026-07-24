# Component Library — Nova Rewards Design System

**Version:** 1.0  
**Framework:** React + Tailwind CSS  
**Last Updated:** 2026-07-23

All components live in `novaRewards/frontend/components/ui/`. Each component uses Tailwind CSS utility classes and references design tokens from `tailwind.config.ts`.

---

## Buttons

### Variants

| Variant | Background | Text | Border | Use When |
|---------|-----------|------|--------|----------|
| `primary` | `primary-600` | `white` | none | Main actions, CTAs |
| `secondary` | `white` | `primary-600` | `primary-600` | Secondary actions |
| `tertiary` | transparent | `primary-600` | none | De-emphasized actions |
| `danger` | `error-600` | `white` | none | Destructive actions |
| `ghost` | transparent | `neutral-600` | none | Utility actions, close buttons |
| `success` | `success-600` | `white` | none | Confirm, complete actions |

### Sizes

| Size | Height | Padding H | Font Size | Min Width |
|------|--------|-----------|-----------|-----------|
| `xs` | 28px | 10px | 12px | 64px |
| `sm` | 32px | 12px | 14px | 80px |
| `md` | 40px | 16px | 14px | 96px |
| `lg` | 48px | 20px | 16px | 112px |
| `xl` | 56px | 24px | 18px | 128px |

> **Accessibility:** All button sizes meet the 44px minimum touch target when accounting for interaction area padding.

### States

| State | Style |
|-------|-------|
| Default | Base variant styles |
| Hover | Darken bg one stop (`primary-700`), `cursor-pointer` |
| Focus | `ring-2 ring-primary-600 ring-offset-2`, no outline |
| Active | Darken bg two stops (`primary-800`), `scale(0.97)` |
| Disabled | `opacity-50`, `cursor-not-allowed`, `pointer-events-none` |
| Loading | Spinner replaces text, `pointer-events-none` |

### Icon Variants

```jsx
// Left icon
<Button icon={<PlusIcon />} iconPosition="left">Add Campaign</Button>

// Right icon
<Button icon={<ArrowRightIcon />} iconPosition="right">Continue</Button>

// Icon-only (requires aria-label)
<Button icon={<XMarkIcon />} iconOnly aria-label="Close" />
```

### Implementation Notes

- Use `<button type="button">` unless in a form (use `type="submit"`)
- Use `disabled` attribute for form validation disabled states
- Use `aria-disabled="true"` + `pointer-events-none` for non-form disabled states
- Loading state must announce to screen readers: `aria-busy="true"`

---

## Inputs

### Types

| Type | Component | Notes |
|------|-----------|-------|
| `text` | `<Input type="text">` | Default |
| `email` | `<Input type="email">` | Triggers email keyboard on mobile |
| `password` | `<Input type="password">` | Show/hide toggle button |
| `number` | `<Input type="number">` | Numeric keyboard on mobile |
| `date` | `<Input type="date">` | Native date picker |
| `search` | `<Input type="search">` | Search icon left, clear button right |
| `select` | `<Select>` | Custom styled dropdown |
| `textarea` | `<Textarea>` | Resizable, min 3 rows |
| `checkbox` | `<Checkbox>` | Custom styled |
| `radio` | `<RadioGroup>` | Custom styled group |

### States

| State | Border | Ring | Background | Text |
|-------|--------|------|-----------|------|
| Default | `neutral-300` | none | `white` | `neutral-900` |
| Focus | `primary-600` | `ring-2 ring-primary-600` | `white` | `neutral-900` |
| Error | `error-500` | `ring-2 ring-error-500` | `white` | `neutral-900` |
| Success | `success-500` | none | `white` | `neutral-900` |
| Disabled | `neutral-200` | none | `neutral-50` | `neutral-400` |

### Label Specification

- Always top-left of input
- Font: 14px / 500 weight (`type-label`)
- Color: `neutral-700`
- Required: red asterisk `<span className="text-error-500" aria-hidden="true">*</span>`
- `for` attribute matches input `id`

### Helper and Error Text

```
[Label] *
[Input field]
[Helper text — neutral-500, 12px] OR [Error text — error-600, 12px, error icon]
```

- Helper text: `id="[input-id]-hint"`, referenced by `aria-describedby`
- Error text: `id="[input-id]-error"`, referenced by `aria-describedby aria-errormessage`
- Error announced to screen reader: `aria-invalid="true"` on input
- Error icon: `ExclamationCircleIcon` 16px, `aria-hidden="true"`

### Password Input

- Default: `type="password"`, eye-slash icon right
- Toggled visible: `type="text"`, eye icon right
- Toggle button: `aria-label="Show password"` / `aria-label="Hide password"`
- Password strength meter (optional): `PasswordStrengthMeter` component

---

## Cards

### Base Card

```
┌──────────────────────────────────────────────┐
│  padding: 24px (p-6)                         │
│  border: 1px solid neutral-200               │
│  border-radius: 12px (rounded-xl)            │
│  background: white (dark: neutral-800)       │
│  shadow: shadow-sm                           │
│                                              │
│  Content goes here                           │
│                                              │
└──────────────────────────────────────────────┘
```

**Hover state** (clickable cards):
- `shadow-md`
- `translateY(-2px)`
- Border: `primary-200`
- Transition: `all 200ms ease-out`

### Reward Card

```
┌──────────────────────────────────┐
│  [Campaign Image — 100% × 160px] │
│  border-radius: 8px (rounded-lg) │
├──────────────────────────────────┤
│  [Badge: status]                 │
│  Title (H3, neutral-900)         │
│  Description (body-sm, neutral-600) │
│                                  │
│  ▓▓▓▓▓▓▓▓░░░░  75% progress     │
│  Ends: Dec 31, 2026              │
│                                  │
│  [Earn Rewards →] [primary CTA]  │
└──────────────────────────────────┘
```

### KPI Card

```
┌────────────────────────────┐
│  [Icon 32px]  Label        │
│                            │
│  1,234.56                  │
│  [large number, 5xl, bold] │
│                            │
│  ↑ +12.3%  vs last week    │
│  [caption, success-500]    │
└────────────────────────────┘
```

### Campaign Card (Merchant)

```
┌──────────────────────────────────┐
│  [Active Badge]  [Menu ⋮]        │
│  Campaign Name (H3)              │
│  Start: Jan 1 → End: Dec 31      │
│                                  │
│  Issued: 45,000 / 100,000 NOVA   │
│  [Progress bar — 45%]            │
│                                  │
│  [View Details] [Edit]           │
└──────────────────────────────────┘
```

---

## Badges

### Variants and Colors

| Variant | Background | Text | Border | Use For |
|---------|-----------|------|--------|---------|
| `success` | `success-100` | `success-700` | none | Active, completed, verified |
| `warning` | `warning-100` | `warning-700` | none | Pending, expiring soon |
| `error` | `error-100` | `error-700` | none | Failed, expired, rejected |
| `info` | `info-100` | `info-700` | none | Informational status |
| `neutral` | `neutral-100` | `neutral-700` | none | Inactive, draft |
| `primary` | `primary-100` | `primary-700` | none | Featured, highlighted |

### Sizes

| Size | Height | Padding H | Font Size |
|------|--------|-----------|-----------|
| `sm` | 18px | 6px | 11px |
| `md` | 22px | 8px | 12px |

### Variants

```jsx
// With dot indicator
<Badge variant="success" dot>Active</Badge>

// With icon
<Badge variant="warning" icon={<ClockIcon />}>Expiring</Badge>

// Pill style (default is rounded-full)
<Badge variant="primary">Featured</Badge>
```

---

## Tooltips

### Specification

- **Background:** `neutral-900` (#0f172a)
- **Text:** `white`
- **Font size:** 13px (between xs and sm)
- **Padding:** 6px 10px
- **Border radius:** 6px
- **Max width:** 280px
- **Arrow:** 6px equilateral triangle, same bg color
- **Delay:** 200ms show, 100ms hide
- **Z-index:** 600 (above modals)

### Positions

```
           ┌──────────────┐
           │   Tooltip    │   ← top (default)
           └──────┬───────┘
                  ▼
           ┌──────────────┐
           │    Trigger   │
           └──────────────┘

   ┌──────────┐              ┌──────────┐
   │ Tooltip  │◄── left  right ──►│ Tooltip  │
   └──────────┘              └──────────┘

           ┌──────────────┐
           │    Trigger   │
           └──────┬───────┘
                  ▼
           ┌──────────────┐
           │   Tooltip    │   ← bottom
           └──────────────┘
```

**Viewport-aware:** Auto-flips to opposite side if tooltip would overflow viewport.

### Accessibility

- Tooltip element: `role="tooltip"` with unique `id`
- Trigger element: `aria-describedby="[tooltip-id]"`
- Closes on `Escape` key
- Does not appear on click (only hover + focus)
- `prefers-reduced-motion`: removes fade transition (instant show/hide)

### Implementation

See `components/ui/Tooltip.jsx`

---

## Dropdowns

### Anatomy

```
┌──────────────────────┐
│ Label          ▾     │  ← Trigger button
└──────────────────────┘
↓ (open)
┌──────────────────────┐
│ Section Header       │  ← Optional group header
├──────────────────────┤
│ ✓ Selected Option    │  ← Active item (checkmark)
│   Another Option     │
│   Option with Icon 🔗│
├──────────────────────┤  ← Divider
│ ⚠ Danger Action      │  ← Danger item (red)
└──────────────────────┘
```

### Specifications

- **Menu background:** `white` (dark: `neutral-800`)
- **Border:** `neutral-200`
- **Shadow:** `shadow-lg`
- **Border radius:** `rounded-lg` (8px)
- **Menu min-width:** matches trigger width, min 200px
- **Item height:** 40px
- **Item padding:** `px-3`
- **Item hover:** `neutral-50` bg (dark: `neutral-700`)
- **Danger item:** `error-600` text, hover `error-50` bg
- **Disabled item:** `neutral-300` text, no hover

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open dropdown / Select item |
| `↓` Arrow Down | Next item |
| `↑` Arrow Up | Previous item |
| `Escape` | Close dropdown |
| `Tab` | Close dropdown, move focus forward |
| `Home` | First item |
| `End` | Last item |

### Accessibility

- Trigger: `aria-haspopup="listbox"` or `"menu"`, `aria-expanded`
- Menu: `role="listbox"` or `"menu"`, `aria-labelledby` pointing to trigger
- Items: `role="option"` or `"menuitem"`, `aria-selected` for selected
- Focus management: focus first item on open, return to trigger on close

---

## Modals

### Anatomy

```
┌──── Backdrop (overlay) ────────────────────────────────────┐
│                                                             │
│        ┌──── Modal Dialog ───────────────────────┐         │
│        │  Modal Title              [×]            │         │
│        │  [subtitle/description]                  │         │
│        ├──────────────────────────────────────────┤         │
│        │                                          │         │
│        │  Modal body content                      │         │
│        │                                          │         │
│        ├──────────────────────────────────────────┤         │
│        │  [Cancel]              [Primary Action]  │         │
│        └──────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Specifications

- Max width: `sm`=400px, `md`=560px, `lg`=720px, `xl`=960px, `full`=100%
- Backdrop: `black/50` (`rgba(0,0,0,0.5)`)
- Background: `white` (dark: `neutral-800`)
- Padding: `24px`
- Border radius: `16px` (`rounded-2xl`)
- Shadow: `shadow-xl`
- Entry animation: `scale(0.95) opacity(0)` → `scale(1) opacity(1)`, 200ms ease-out
- Exit animation: reverse, 150ms ease-in

### Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title
- Focus trap: tab cycles within modal only
- Close on `Escape`
- Close on backdrop click (optional, configurable)
- Return focus to trigger element on close
- Scroll body locked while modal is open

---

## Form Patterns

### Standard Form Layout

```
┌──────────────────────────────────────────────────────────┐
│  Form Title (H2)                                         │
│  Subtitle or description                                  │
│                                                          │
│  Full Name *                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│  Enter your full name as it appears on your ID           │
│                                                          │
│  Email Address *                                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │ john@example.com                                 │    │
│  └──────────────────────────────────────────────────┘    │
│  ✗ Please enter a valid email address (error state)       │
│                                                          │
│  [Cancel]                           [Submit →]           │
└──────────────────────────────────────────────────────────┘
```

### Spacing Rules

- Field top margin: `mt-6` (24px) between fields
- Label to input: `mt-1.5` (6px)
- Input to helper text: `mt-1` (4px)
- Group of fields: `space-y-6`

---

## Component Checklist

Before shipping any component:

- [ ] All interactive states designed (default, hover, focus, active, disabled)
- [ ] Mobile layout verified at 320px minimum width
- [ ] Dark mode variant implemented
- [ ] Keyboard accessible (navigable, operable)
- [ ] Screen reader accessible (ARIA roles/labels)
- [ ] Meets WCAG AA contrast (4.5:1 text, 3:1 large text + graphics)
- [ ] Touch targets ≥ 44×44px
- [ ] Focus ring visible
- [ ] `prefers-reduced-motion` respected for animations
- [ ] Storybook stories created
- [ ] Unit tests written
- [ ] Snapshot test added

---

## File Structure

```
components/ui/
├── Button.jsx              ✅ Exists
├── Input.jsx               ✅ Exists
├── Input.jsx               ✅ Exists (enhanced version: TextInput.jsx)
├── Card.jsx                ✅ Exists
├── Badge.jsx               ✅ Exists
├── Dropdown.jsx            ✅ Exists
├── Modal.js                ✅ Exists
├── Tooltip.jsx             ✅ New (UX-03)
├── Checkbox.jsx            ✅ Exists
├── RadioGroup.jsx          ✅ Exists
├── Textarea.jsx            ✅ Exists
├── Select.js               ✅ Exists
├── Alert.jsx               ✅ Exists
├── AnimatedCounter.jsx     ✅ Exists
└── index.js                ✅ Barrel export
```
