# feat: Paginated Transaction History Page

**Closes #592**

## Summary

Implements the transaction history page for connected wallets, showing all reward issuances, redemptions, and transfers with filtering, pagination, and CSV export.

## Changes

### `novaRewards/frontend/components/TransactionHistory.js` _(new)_
- Paginated table with **20 transactions per page** using offset-based cursor pagination
- Filter controls: **transaction type**, **date range** (start/end), and **campaign**
- Each row displays: type badge, amount, campaign name, date, status badge, and Stellar Explorer link
- **CSV export** button fetches full filtered history and triggers a browser download
- **Empty state** rendered when no transactions match the current filters
- Skeleton loading state while data is fetching

### `novaRewards/frontend/pages/history.js` _(updated)_
- Replaced `RewardsHistory` with the new `TransactionHistory` component
- Passes authenticated `user.id` as `userId` prop

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Paginated list — 20 transactions per page, cursor-based | ✅ |
| Filter controls: type, date range, campaign | ✅ |
| Each row: type, amount, campaign, date, status, Stellar Explorer link | ✅ |
| CSV export downloads full history | ✅ |
| Empty state when no transactions exist | ✅ |

## Testing

- Manually verified filter combinations reset pagination to page 1
- CSV export triggers download with correct headers and quoted fields
- Empty state renders when `transactions` array is empty
- Stellar Explorer links open correct URL: `https://stellar.expert/explorer/public/tx/{txHash}`
