# Email Template Design — Nova Rewards

**Last Updated:** 2026-07-23

## Templates

| Template | File | Trigger |
|----------|------|---------|
| Welcome | `welcome.html` | Account created |
| Reward Earned | `reward-earned.html` | NOVA tokens issued |
| Transaction Confirmation | `transaction-confirmation.html` | Blockchain tx |

## Layout Specs

- Max width: 600px, `border-radius: 16px`
- Page bg: `#f1f5f9` / Card bg: `#ffffff`
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
- Inner padding: 40px desktop → 16px mobile (via media query)

## Typography

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Brand header | 20px | 700 | white on `#7c3aed` |
| H1 | 24px | 700 | `#0f172a` |
| Body | 16px | 400 | `#475569` |
| Detail label | 14px | 400 | `#64748b` |
| Detail value | 14px | 500 | `#0f172a` |
| CTA button | 15px | 600 | white on `#7c3aed` |
| Footer | 12px | 400 | `#94a3b8` |

## Colors

| Role | Hex |
|------|-----|
| Brand | `#7c3aed` |
| Brand light | `#f5f3ff` |
| Success amount | `#16a34a` |
| Border | `#e2e8f0` |
| Footer bg | `#f8fafc` |

## Dark Mode

`@media (prefers-color-scheme: dark)` overrides: card → `#1e293b`, text → `#f8fafc`, border → `#334155`.  
Tested: Apple Mail, Gmail app dark mode.

## Template Variables (`{{variable}}`)

`amount` · `merchant_name` · `new_balance` · `tx_hash_short` · `explorer_url` · `date` · `dashboard_url` · `unsubscribe_url`

## Accessibility

- `lang="en"` on `<html>`
- Decorative SVGs: `aria-hidden="true"`
- All `<img>` have `alt` text
- CTA uses `<a>` not `<button>` (email client compat)
- Contrast meets WCAG AA in both light and dark modes

## Cross-Client Notes

- **Outlook 2019+:** SVG unsupported → use VML fallback or PNG logo
- **Gmail Android:** ignores media queries → all critical layout inline
- Test with Litmus or Email on Acid before sending
