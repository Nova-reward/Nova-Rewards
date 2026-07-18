import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
     {
      type: "doc",
      id: "api/index",
      label: "API Overview",
    },
     {
      type: "doc",
      id: "api/authentication",
    },
    {
      type: "doc",
      id: "api/rate-limits",
    },
    {
      type: "doc",
      id: "api/errors",
    },
    {
      type: "doc",
      id: "api/novarewards-api",
    },
    {
      type: "category",
      label: "Admin",
      items: [
        {
          type: "doc",
          id: "api/get-aggregate-platform-statistics",
          label: "Get aggregate platform statistics",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/paginated-user-list-searchable-by-email-or-name",
          label: "Paginated user list, searchable by email or name",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/create-a-new-reward",
          label: "Create a new reward",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/update-a-reward",
          label: "Update a reward",
          className: "api-method patch",
        },
        {
          type: "doc",
          id: "api/soft-delete-a-reward",
          label: "Soft-delete a reward",
          className: "api-method delete",
        },
        {
          type: "doc",
          id: "api/list-paginated-email-logs",
          label: "List paginated email logs",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-a-specific-email-log-by-id",
          label: "Get a specific email log by ID",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Auth",
      items: [
        {
          type: "doc",
          id: "api/register-a-new-user-account",
          label: "Register a new user account",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/authenticate-and-obtain-jwt-tokens",
          label: "Authenticate and obtain JWT tokens",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Campaigns",
      items: [
        {
          type: "doc",
          id: "api/create-a-reward-campaign",
          label: "Create a reward campaign",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/list-campaigns-for-the-authenticated-merchant",
          label: "List campaigns for the authenticated merchant",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/list-campaigns-for-a-given-merchant-id",
          label: "List campaigns for a given merchant ID",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Contract Events",
      items: [
        {
          type: "doc",
          id: "api/list-paginated-contract-events",
          label: "List paginated contract events",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-a-specific-contract-event-by-id",
          label: "Get a specific contract event by ID",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Drops",
      items: [
        {
          type: "doc",
          id: "api/list-active-drops-the-authenticated-user-qualifies-for",
          label: "List active drops the authenticated user qualifies for",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/claim-a-drop-for-the-authenticated-user",
          label: "Claim a drop for the authenticated user",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      items: [
        {
          type: "doc",
          id: "api/basic-health-check",
          label: "Basic health check",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/detailed-health-check",
          label: "Detailed health check",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Leaderboard",
      items: [
        {
          type: "doc",
          id: "api/get-top-users-by-earned-points",
          label: "Get top users by earned points",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Merchants",
      items: [
        {
          type: "doc",
          id: "api/register-a-new-merchant",
          label: "Register a new merchant",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Redemptions",
      items: [
        {
          type: "doc",
          id: "api/redeem-a-reward",
          label: "Redeem a reward",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/list-redemption-history-for-the-authenticated-user",
          label: "List redemption history for the authenticated user",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-a-single-redemption-by-id",
          label: "Get a single redemption by ID",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Rewards",
      items: [
        {
          type: "doc",
          id: "api/distribute-nova-tokens-to-a-customer-wallet",
          label: "Distribute NOVA tokens to a customer wallet",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Search",
      items: [
        {
          type: "doc",
          id: "api/full-text-search-across-rewards-campaigns-and-users",
          label: "Full-text search across rewards, campaigns, and users",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/autocomplete-suggestions",
          label: "Autocomplete suggestions",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/record-a-click-through-on-a-search-result",
          label: "Record a click-through on a search result",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Transactions",
      items: [
        {
          type: "doc",
          id: "api/verify-and-record-a-stellar-transaction",
          label: "Verify and record a Stellar transaction",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/get-total-nova-distributed-and-redeemed-for-the-authenticated-merchant",
          label: "Get total NOVA distributed and redeemed for the authenticated merchant",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-nova-transaction-history-for-a-wallet",
          label: "Get NOVA transaction history for a wallet",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/paginated-transaction-history-for-a-user",
          label: "Paginated transaction history for a user",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Trustline",
      items: [
        {
          type: "doc",
          id: "api/check-whether-a-wallet-has-an-active-nova-trustline",
          label: "Check whether a wallet has an active NOVA trustline",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/build-an-unsigned-change-trust-xdr-for-the-user-to-sign-with-freighter",
          label: "Build an unsigned changeTrust XDR for the user to sign with Freighter",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Users",
      items: [
        {
          type: "doc",
          id: "api/create-a-new-user-with-optional-referral-tracking",
          label: "Create a new user with optional referral tracking",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/get-current-point-balance-for-a-wallet-address",
          label: "Get current point balance for a wallet address",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-users-on-chain-token-balance",
          label: "Get user's on-chain token balance",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/get-user-profile-public-or-private-depending-on-ownership",
          label: "Get user profile (public or private depending on ownership)",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/partial-profile-update",
          label: "Partial profile update",
          className: "api-method patch",
        },
        {
          type: "doc",
          id: "api/soft-delete-and-anonymise-a-user-account",
          label: "Soft-delete and anonymise a user account",
          className: "api-method delete",
        },
        {
          type: "doc",
          id: "api/get-referral-statistics-for-a-user",
          label: "Get referral statistics for a user",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api/manually-process-a-referral-bonus",
          label: "Manually process a referral bonus",
          className: "api-method post",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
