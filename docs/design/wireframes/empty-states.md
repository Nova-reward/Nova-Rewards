# Empty States Design Guide — Nova Rewards

**Version:** 1.0  
**Last Updated:** 2026-07-23

---

## When to Use Each State

| State | Use When | Don't Use When |
|-------|----------|----------------|
| **Empty state** | Content genuinely doesn't exist yet | Content is loading |
| **Skeleton** | Content is loading for first time | Content exists but there's an error |
| **Error state** | Request failed / can't load data | Content is just empty |
| **Zero results** | Search/filter returns nothing | Page has never had data |

---

## Empty State Structure

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│           [Illustration — 200×160px SVG]             │
│              neutral-300 line art style              │
│                                                      │
│         Action-Oriented Headline                     │
│         [H3 — 20px, neutral-900, center]            │
│                                                      │
│    Short, encouraging description in 1-2 lines.     │
│    [body-sm — 14px, neutral-500, center]            │
│                                                      │
│         ┌────────────────────────────┐              │
│         │  Primary Action →          │              │
│         │  [Optional CTA button]     │              │
│         └────────────────────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 6 Empty State Variants

### 1. No Rewards (`no-rewards`)

```
[⭐ Star illustration]
No rewards earned yet
Browse partner campaigns to start earning NOVA tokens.
[Browse Campaigns →]
```

### 2. No Transactions (`no-transactions`)

```
[🕐 Clock illustration]
No activity yet
Earn or redeem NOVA tokens to see your transaction history here.
[Start Earning →]
```

### 3. No Campaigns (`no-campaigns`)

```
[📢 Megaphone illustration]
No active campaigns
Check back soon — new merchant campaigns are added regularly.
[Notify Me →] (optional)
```

### 4. Wallet Not Connected (`no-wallet`)

```
[👛 Wallet illustration]
Connect your wallet
Connect a Stellar wallet to see your NOVA balance and transactions.
[Connect Wallet →]
```

### 5. Loading Error (`loading-error`)

```
[⚠ Triangle warning illustration]
Something went wrong
[Error message from API, if available]
[Try Again →]
```

### 6. Search Empty (`search-empty`)

```
[🔍 Magnifier illustration]
No results for "coffee"
Try a different search term or browse all campaigns.
[Clear Search ×]
```

---

## Copy Guidelines

✅ **Do:**
- Use action-oriented headlines: "No rewards earned yet"
- Describe what the user can do: "Browse campaigns to start earning"
- Be encouraging, never apologetic
- Keep descriptions under 2 lines (max 100 chars)
- Match the page context

❌ **Don't:**
- Say "No data found" (robotic)
- Say "Sorry, there's nothing here" (apologetic)
- Show technical error codes in user-facing messages
- Include multiple CTAs that compete with each other

---

## Illustration Guidelines

- Format: SVG (inline or `<img>` with alt text)
- Dimensions: 200×160px (desktop), 160×128px (mobile)
- Style: Light line art, single color using `currentColor`
- Color: `neutral-300` on light mode, `neutral-600` on dark mode
- Accessibility: decorative → `aria-hidden="true"`, or `role="img"` with `alt` text
- Do not use illustrations that require understanding specific shapes (color-blind safe)

---

## Sizing and Spacing

```
Container: flex flex-col items-center text-center py-12 px-6
Illustration margin-bottom: mb-6 (24px)
Headline margin-bottom: mb-2 (8px)
Description margin-bottom: mb-6 (24px)
```

---

## Dark Mode

- Illustration: `text-neutral-600` (auto via `currentColor`)
- Headline: `text-white`
- Description: `text-neutral-400`
- CTA button: uses standard button dark mode styles
