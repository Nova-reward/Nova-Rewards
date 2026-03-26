# Requirements Document

## Introduction

The campaign-status-badge feature adds a visual status indicator to each campaign row in the novaRewards merchant portal. Each badge reflects the campaign's current status — derived from the `is_active` flag and `end_date` field — so merchants can immediately understand which campaigns are running, which have expired, and which have been manually deactivated.

The badge is a purely frontend concern: no new API endpoints are required. The existing `/api/campaigns/:merchantId` response already returns `is_active` and `end_date`.

## Glossary

- **Badge**: A small, pill-shaped inline element rendered inside the campaign table's Status column that communicates campaign status through colour and a text label.
- **Campaign**: A merchant-defined reward programme with a name, reward rate, start date, end date, and an active flag stored in the `campaigns` table.
- **CampaignStatusBadge**: The React component responsible for computing and rendering the badge for a single campaign.
- **Merchant_Portal**: The Next.js page at `novaRewards/frontend/pages/merchant.js` that lists campaigns for a registered merchant.
- **Status**: The derived state of a campaign, one of: `Active`, `Expired`, or `Inactive`.

## Requirements

### Requirement 1: Derive Campaign Status

**User Story:** As a merchant, I want each campaign to show a clear status label, so that I can tell at a glance whether a campaign is currently running, has ended, or has been turned off.

#### Acceptance Criteria

1. WHEN `is_active` is `true` AND the current date is on or before `end_date`, THE CampaignStatusBadge SHALL display the label "Active".
2. WHEN `is_active` is `true` AND the current date is after `end_date`, THE CampaignStatusBadge SHALL display the label "Expired".
3. WHEN `is_active` is `false`, THE CampaignStatusBadge SHALL display the label "Inactive" regardless of `end_date`.
4. THE CampaignStatusBadge SHALL derive status using the client's local date at the time of render.

### Requirement 2: Visual Differentiation by Status

**User Story:** As a merchant, I want each status badge to use a distinct colour, so that I can distinguish campaign states without reading the label text.

#### Acceptance Criteria

1. WHEN the derived status is "Active", THE CampaignStatusBadge SHALL apply the `badge-green` CSS class.
2. WHEN the derived status is "Expired", THE CampaignStatusBadge SHALL apply the `badge-orange` CSS class.
3. WHEN the derived status is "Inactive", THE CampaignStatusBadge SHALL apply the `badge-gray` CSS class.
4. THE CampaignStatusBadge SHALL render as a pill-shaped inline element consistent with the existing `.badge` base style defined in `globals.css`.

### Requirement 3: Integration into Campaign Table

**User Story:** As a merchant, I want the status badge to appear in the campaign list table, so that I can see all campaign details and their status in one place.

#### Acceptance Criteria

1. THE Merchant_Portal SHALL render a CampaignStatusBadge in the "Status" column for every campaign row.
2. WHEN the campaign list is empty, THE Merchant_Portal SHALL display the existing "No campaigns yet" message and SHALL NOT render any CampaignStatusBadge.
3. THE Merchant_Portal SHALL pass `is_active` and `end_date` as props to each CampaignStatusBadge instance.

### Requirement 4: Accessibility

**User Story:** As a merchant using assistive technology, I want the badge to convey status in a way that is accessible, so that I am not reliant on colour alone.

#### Acceptance Criteria

1. THE CampaignStatusBadge SHALL include a visible text label ("Active", "Expired", or "Inactive") so that status is not communicated by colour alone.
2. THE CampaignStatusBadge SHALL render with an `aria-label` attribute whose value matches the visible text label.

### Requirement 5: CSS Token for Expired State

**User Story:** As a developer, I want a dedicated CSS token for the "Expired" badge colour, so that the expired state is visually distinct from both active and inactive states.

#### Acceptance Criteria

1. THE Merchant_Portal stylesheet SHALL define `--badge-orange-bg` and `--badge-orange-text` CSS custom properties in the `:root` block.
2. WHERE a dark colour scheme is active, THE Merchant_Portal stylesheet SHALL define dark-mode values for `--badge-orange-bg` and `--badge-orange-text` inside the `@media (prefers-color-scheme: dark)` block.
3. THE stylesheet SHALL define a `.badge-orange` rule that applies `background: var(--badge-orange-bg)` and `color: var(--badge-orange-text)`.
