# Dashboard Data Visualization Specs — Nova Rewards

**Version:** 1.0  
**Last Updated:** 2026-07-23  
**Library:** Recharts (already used in project)

---

## Chart Color Palette

Consistent across all charts. References design tokens:

| Segment | Token | Hex | Usage |
|---------|-------|-----|-------|
| Primary | `primary-500` | `#8b5cf6` | NOVA earned, primary series |
| Secondary | `secondary-500` | `#6366f1` | Staked tokens |
| Success | `success-500` | `#22c55e` | Positive trend, redeemed |
| Warning | `warning-500` | `#f59e0b` | Pending, near-expiry |
| Error | `error-500` | `#ef4444` | Negative trend, failed |
| Info | `info-500` | `#3b82f6` | Neutral data series |
| Neutral | `neutral-300` | `#cbd5e1` | Empty/placeholder |

---

## Line Chart — Rewards Over Time

### Dimensions

| Property | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| Width | 100% | 100% | 100% |
| Height | 260px | 220px | 180px |
| Padding | 16px all sides | 12px | 8px |

### Specification

```
┌──────────────────────────────────────────────────────────────────┐
│  Rewards Over Time                [7d] [30d] [90d] [All]         │
│                                                                  │
│  NOVA ▲                                                          │
│  200  ┤                    ╭────────╮                            │
│  150  ┤          ╭─────────╯        ╰──────╮                    │
│  100  ┤    ╭─────╯                          ╰─────╮             │
│   50  ┤────╯                                       ╰────        │
│    0  └──────────────────────────────────────────────────→ Date │
│       Jan   Feb   Mar   Apr   May   Jun   Jul                    │
│                                                                  │
│  [● NOVA Earned]                                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Recharts Configuration

```jsx
<ResponsiveContainer width="100%" height={260}>
  <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
    <XAxis
      dataKey="date"
      tick={{ fontSize: 12, fill: '#64748b' }}
      tickLine={false}
      axisLine={false}
    />
    <YAxis
      tick={{ fontSize: 12, fill: '#64748b' }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v) => `${v}`}
    />
    <Tooltip
      contentStyle={{
        background: '#0f172a',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        fontSize: '13px',
      }}
      formatter={(value) => [`${value} NOVA`, 'Earned']}
    />
    <Line
      type="monotone"
      dataKey="earned"
      stroke="#8b5cf6"
      strokeWidth={2.5}
      dot={false}
      activeDot={{ r: 5, fill: '#7c3aed' }}
    />
  </LineChart>
</ResponsiveContainer>
```

### Date Range Picker

- Buttons: `[7d] [30d] [90d] [All]`
- Active: `primary-600` bg, white text, rounded
- Inactive: neutral-100 bg, neutral-600 text
- Keyboard: tab to button, space/enter to select
- Mobile: full-width selector or pill buttons

### Loading State

```
┌──────────────────────────────────────────────────┐
│  ████████████████  (skeleton title + buttons)    │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░ Chart skeleton — 260px height shimmer ░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└──────────────────────────────────────────────────┘
```

### Empty State

```
┌──────────────────────────────────────────────────┐
│  Rewards Over Time                               │
│                                                  │
│          ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐           │
│          │                           │           │
│          │   📊 No data yet          │           │
│          │   Earn rewards to see     │           │
│          │   your activity here      │           │
│          │                           │           │
│          └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘           │
└──────────────────────────────────────────────────┘
```

---

## Donut Chart — Token Distribution

### Dimensions

| Property | Desktop | Mobile |
|----------|---------|--------|
| Diameter | 200px | 160px |
| Inner radius | 60px | 48px |
| Outer radius | 100px | 80px |

### Specification

```
              ┌───────────────┐
              │               │
              │    ╭─────╮    │
              │  ╱         ╲  │
              │ │  1,234.56 │ │  ← center text (total)
              │ │    NOVA   │ │
              │  ╲         ╱  │
              │    ╰─────╯    │
              │               │
              └───────────────┘
               [● Earned 65%]
               [● Staked 25%]
               [● Redeemed 10%]
```

### Hover State

- Segment lifts by 4px on hover
- Center text updates to show segment label + value
- Adjacent segments dim to 60% opacity

### Center Text

- Line 1: formatted number (e.g., "1,234.56")
- Line 2: "NOVA total" in neutral-500

### Legend

- Items: dot (8px) + label (body-sm) + value (caption neutral-500)
- Layout: vertical stack below chart (desktop), grid 2-col (mobile)

### Accessibility

```jsx
<figure aria-label="Token distribution">
  <figcaption className="sr-only">
    Token distribution: 65% earned (803 NOVA), 25% staked (309 NOVA),
    10% redeemed (123 NOVA)
  </figcaption>
  {/* Recharts PieChart */}
</figure>
```

---

## Bar Chart — Campaign Performance

### Dimensions: 100% width × 200px height

```
     ┌──────────────────────────────────────────────────┐
│100 ┤  ██                                               │
│ 75 ┤  ██  ██                                          │
│ 50 ┤  ██  ██  ██                                      │
│ 25 ┤  ██  ██  ██  ██                                  │
│  0 └─────────────────────────────────────────────────→│
     Coffee  Book  Tech  Fashion  Food  Fitness  Travel  │
```

### Configuration

- Bar width: auto (responsive)
- Bar gap: 8px
- Corner radius: 4px (top corners only)
- Colors: cycle through chart palette
- Tooltip: dark bg, shows exact value
- Axis: no gridlines on X, horizontal gridlines on Y

---

## Sparklines (KPI Cards)

Compact trend charts embedded in KPI cards.

### Dimensions

- Width: 60px
- Height: 24px
- No axes, no labels, no tooltip

### Specification

```jsx
<ResponsiveContainer width={60} height={24}>
  <LineChart data={sparkData}>
    <Line
      type="monotone"
      dataKey="value"
      stroke={trend >= 0 ? '#22c55e' : '#ef4444'}
      strokeWidth={1.5}
      dot={false}
    />
  </LineChart>
</ResponsiveContainer>
```

---

## Chart Performance Guidelines

1. **Lazy load** chart components: `const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false })`
2. **Memoize** data transforms with `useMemo`
3. **Debounce** resize observers (500ms) for `ResponsiveContainer`
4. **Reduce re-renders** with `React.memo` on chart wrapper components
5. **Skeleton first:** always show skeleton while data loads
6. **Error boundary:** wrap charts in `ErrorBoundary` with `ChartEmptyState` fallback

---

## Accessibility for Charts

All charts must have:

1. `<figure>` wrapper with `aria-label` or `aria-labelledby`
2. `<figcaption>` with screen-reader-only text summary (`.sr-only`)
3. Tooltip accessible via keyboard (tab to activate, escape to dismiss)
4. Color is not the only differentiator — use patterns or labels too
5. High-contrast mode: use `border` instead of fill for segment distinction
