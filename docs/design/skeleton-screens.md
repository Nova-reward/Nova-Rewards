# Skeleton Screens — Nova Rewards

**Last Updated:** 2026-07-23

## When to Use

Use skeletons (not spinners) for **first load** of page-level content. Use spinners for quick actions (button submit, refresh). Use empty states after content loads with zero results.

## Components (in `components/Skeleton.js`)

| Export | Use Case |
|--------|----------|
| `SkeletonBlock` | Generic shimmer block, base primitive |
| `SkeletonCard` | Reward / campaign card |
| `SkeletonRow` | Transaction list row |
| `SkeletonNotification` | Notification item |
| `SkeletonDashboard` | Full dashboard grid |
| `SkeletonGrid` | Grid of cards (count prop) |
| `SkeletonLeaderboard` | Leaderboard table rows |
| `SkeletonAnalytics` | Analytics stats + charts |
| `SkeletonProfile` | Profile page layout |
| `SkeletonTransactionHistory` | Filter bar + table rows |
| `SkeletonMerchantDashboard` | KPI cards + chart + list |

Additional in `components/ui/Skeleton.jsx`:

| Export | Use Case |
|--------|----------|
| `SkeletonText` | 1–N lines of text |
| `SkeletonTable` | Configurable rows × cols |
| `withSkeletonTimeout` | HOC: timeout → error fallback after N ms |

## Animation

- `animate-pulse` (Tailwind) — opacity 1↔0.5, 2s loop
- Shimmer variant: `translateX(-100%→200%)` gradient sweep, 1.5s linear
- Reduced motion: both animations disabled, static neutral block shown

## Accessibility

- Containers: `role="status"` + `aria-label="Loading [section]"` + `aria-busy="true"`  
- Inner blocks: `aria-hidden="true"` (screen readers only hear the live region label)
- On data load: remove `role="status"`, announce content via `aria-live="polite"` on parent

## Performance

- Skeleton renders without any API calls — instant paint
- Use CSS animations only (no JS timers for shimmer)
- `withSkeletonTimeout` prevents infinite skeleton if API never resolves (default 10s)

## Usage

```jsx
import { SkeletonDashboard } from '@/components/Skeleton';

function Dashboard() {
  const { data, loading } = useDashboard();
  if (loading) return <SkeletonDashboard />;
  return <DashboardContent data={data} />;
}

// With timeout fallback
const SafeSkeleton = withSkeletonTimeout(SkeletonGrid, ErrorState, 10000);
<SafeSkeleton isLoading={loading} count={6}>{children}</SafeSkeleton>
```
