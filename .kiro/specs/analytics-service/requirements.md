# Requirements Document

## Introduction

This feature introduces an Analytics Service for the Nova-Rewards backend (GitHub issue #362).
The backend currently has no analytics capability beyond raw transaction records and Prometheus
HTTP metrics. This spec covers: structured event tracking for key user actions, user behaviour
analytics (DAU/WAU/MAU, retention, session patterns), campaign performance metrics, revenue
analytics, funnel analysis, cohort analysis, and an admin-only analytics dashboard API.

Event data is stored in a new `analytics_events` PostgreSQL table. Aggregate metrics are derived
from both `analytics_events` and the existing `transactions`, `point_transactions`, `users`,
`campaigns`, and `redemptions` tables. Redis is used to cache expensive aggregation queries.
The service is implemented as a Node.js/Express module following the existing patterns in the
codebase (JWT auth, `requireAdmin` middleware, `prom-client` metrics, `fast-check` PBT).

---

## Glossary

- **Analytics_Service**: The module (`services/analyticsService.js`) responsible for persisting
  events, computing aggregates, and serving analytics data to the dashboard API.
- **Event_Store**: The PostgreSQL table `analytics_events` that records every tracked user action.
- **Analytics_Event**: A single row in `analytics_events` representing one user action, with
  fields `id`, `event_type`, `user_id`, `session_id`, `metadata` (JSONB), and `occurred_at`.
- **Event_Type**: An enumerated string identifying the action:
  `reward_earned`, `reward_redeemed`, `campaign_viewed`, `user_registered`, `referral_made`.
- **Active_User**: A user who has at least one Analytics_Event or `point_transactions` row within
  the measurement window (day, week, or month).
- **DAU**: Daily Active Users — count of distinct Active_Users within a calendar day (UTC).
- **WAU**: Weekly Active Users — count of distinct Active_Users within a calendar week (UTC Mon–Sun).
- **MAU**: Monthly Active Users — count of distinct Active_Users within a calendar month (UTC).
- **Retention_Rate**: The fraction of users active in period N−1 who are also active in period N,
  expressed as a float in [0, 1].
- **Campaign_Metrics**: Aggregated statistics for a single campaign: distribution count,
  redemption count, conversion rate, total NOVA distributed, and total NOVA redeemed.
- **Conversion_Rate**: `redemption_count / distribution_count` for a campaign, a float in [0, 1].
  Defined as 0 when `distribution_count` is 0.
- **Revenue_Series**: A time-ordered list of `{ period, nova_distributed, nova_redeemed }` records
  bucketed by day, week, or month.
- **Funnel**: The ordered sequence of steps: `user_registered` → `reward_earned` → `reward_redeemed`
  → `repeat_redemption` (≥2 redemptions). Each step count is ≤ the previous step count.
- **Cohort**: A group of users whose `users.created_at` falls within the same calendar week or month.
- **Cohort_Retention_Matrix**: A 2-D structure where rows are Cohorts and columns are periods
  elapsed since cohort formation; each cell is the fraction of the cohort active in that period.
- **Analytics_Cache**: Redis keys under the prefix `nova:analytics:` used to cache aggregation
  query results with configurable TTLs.
- **Dashboard_API**: The set of admin-only HTTP endpoints under `/api/admin/analytics/` that
  expose aggregated analytics data.
- **Metrics_Collector**: The existing prom-client registry extended with analytics-specific counters.

---

## Requirements

### Requirement 1: Event Tracking

**User Story:** As a product manager, I want every key user action recorded as a structured event,
so that I can analyse user behaviour and feature adoption over time.

#### Acceptance Criteria

1. WHEN a user earns a reward (a `point_transactions` row of type `earned` is inserted), THE
   Analytics_Service SHALL persist an Analytics_Event with `event_type = 'reward_earned'`,
   the `user_id`, and `metadata` containing `{ campaign_id, amount }`.
2. WHEN a user redeems a reward (a `redemptions` row is inserted), THE Analytics_Service SHALL
   persist an Analytics_Event with `event_type = 'reward_redeemed'`, the `user_id`, and
   `metadata` containing `{ reward_id, points_spent }`.
3. WHEN a user views a campaign (a `GET /api/campaigns/:id` request completes with HTTP 200), THE
   Analytics_Service SHALL persist an Analytics_Event with `event_type = 'campaign_viewed'`,
   the `user_id` from the JWT, and `metadata` containing `{ campaign_id }`.
4. WHEN a new user account is created (a `users` row is inserted), THE Analytics_Service SHALL
   persist an Analytics_Event with `event_type = 'user_registered'`, the new `user_id`, and
   `metadata` containing `{ referred_by }` (null if no referrer).
5. WHEN a referral bonus is credited (a `point_transactions` row of type `referral` is inserted),
   THE Analytics_Service SHALL persist an Analytics_Event with `event_type = 'referral_made'`,
   the referrer's `user_id`, and `metadata` containing `{ referred_user_id, bonus_amount }`.
6. THE Event_Store SHALL enforce that every Analytics_Event row has a non-null `event_type`,
   non-null `user_id`, and non-null `occurred_at` timestamp.
7. IF persisting an Analytics_Event fails (e.g. database error), THEN THE Analytics_Service SHALL
   log the error and allow the originating operation to complete successfully without rethrowing.
8. THE Analytics_Service SHALL persist Analytics_Events asynchronously (fire-and-forget) so that
   event tracking does not add latency to the originating request path.

---

### Requirement 2: User Behaviour Analytics

**User Story:** As a product manager, I want DAU, WAU, MAU, retention rates, and session patterns,
so that I can measure user engagement and identify drop-off trends.

#### Acceptance Criteria

1. WHEN `GET /api/admin/analytics/active-users` is requested with a `period` query parameter of
   `day`, `week`, or `month`, THE Analytics_Service SHALL return the count of distinct Active_Users
   for the most recent complete period of that type.
2. WHEN `GET /api/admin/analytics/active-users` is requested with a `date` query parameter (ISO
   8601 date string), THE Analytics_Service SHALL return the Active_User count for the period
   containing that date.
3. THE Analytics_Service SHALL compute Active_User counts by querying both `analytics_events` and
   `point_transactions` tables and returning the count of distinct `user_id` values present in
   either table within the specified window.
4. WHEN `GET /api/admin/analytics/retention` is requested with `period` (`week` or `month`) and
   `date` query parameters, THE Analytics_Service SHALL return the Retention_Rate as a float in
   [0, 1] for the period containing `date` relative to the immediately preceding period.
5. IF the preceding period has zero Active_Users, THEN THE Analytics_Service SHALL return a
   Retention_Rate of `null` rather than dividing by zero.
6. WHEN `GET /api/admin/analytics/session-patterns` is requested, THE Analytics_Service SHALL
   return, for each user, the `first_activity` and `last_activity` timestamps derived from
   `analytics_events.occurred_at`, and the total `event_count`.
7. THE Analytics_Service SHALL cache Active_User count results in the Analytics_Cache under
   `nova:analytics:active-users:<period>:<date>` with a TTL of 300 seconds.

---

### Requirement 3: Campaign Performance Metrics

**User Story:** As a merchant, I want to see how my campaigns are performing in terms of
distributions, redemptions, conversion rate, and revenue, so that I can optimise future campaigns.

#### Acceptance Criteria

1. WHEN `GET /api/admin/analytics/campaigns` is requested, THE Analytics_Service SHALL return
   Campaign_Metrics for every campaign, sorted by `conversion_rate` descending.
2. WHEN `GET /api/admin/analytics/campaigns/:campaignId` is requested, THE Analytics_Service SHALL
   return Campaign_Metrics for the specified campaign.
3. THE Analytics_Service SHALL compute `distribution_count` as the count of `transactions` rows
   with `tx_type = 'distribution'` and the matching `campaign_id`.
4. THE Analytics_Service SHALL compute `redemption_count` as the count of `point_transactions`
   rows with `type = 'redeemed'` and the matching `campaign_id`.
5. THE Analytics_Service SHALL compute `Conversion_Rate` as `redemption_count / distribution_count`,
   returning `0` when `distribution_count` is `0`.
6. THE Analytics_Service SHALL compute `nova_distributed` as the sum of `transactions.amount` where
   `tx_type = 'distribution'` and the matching `campaign_id`.
7. THE Analytics_Service SHALL compute `nova_redeemed` as the sum of `transactions.amount` where
   `tx_type = 'redemption'` and the matching `campaign_id`.
8. IF `GET /api/admin/analytics/campaigns/:campaignId` is requested for a non-existent campaign,
   THEN THE Analytics_Service SHALL return HTTP 404 with `error: 'not_found'`.
9. THE Analytics_Service SHALL cache campaign metrics results under
   `nova:analytics:campaign:<campaignId>` with a TTL of 600 seconds.

---

### Requirement 4: Revenue Analytics

**User Story:** As a finance stakeholder, I want to see total NOVA distributed and redeemed over
time, so that I can track platform revenue and token velocity.

#### Acceptance Criteria

1. WHEN `GET /api/admin/analytics/revenue` is requested with a `granularity` query parameter of
   `day`, `week`, or `month`, THE Analytics_Service SHALL return a Revenue_Series covering the
   last 30 days (for `day`), last 12 weeks (for `week`), or last 12 months (for `month`).
2. WHEN `GET /api/admin/analytics/revenue` is requested with `start_date` and `end_date` query
   parameters (ISO 8601 date strings), THE Analytics_Service SHALL return a Revenue_Series
   covering the specified date range at the requested granularity.
3. THE Analytics_Service SHALL compute each Revenue_Series bucket by summing `transactions.amount`
   grouped by `tx_type` and the truncated `created_at` timestamp for the requested granularity.
4. THE Analytics_Service SHALL include a `totals` object in the response with `total_nova_distributed`
   and `total_nova_redeemed` as the sum across all buckets in the returned series.
5. IF `start_date` is after `end_date`, THEN THE Analytics_Service SHALL return HTTP 400 with
   `error: 'validation_error'` and a descriptive message.
6. THE Analytics_Service SHALL cache revenue series results under
   `nova:analytics:revenue:<granularity>:<start>:<end>` with a TTL of 300 seconds.

---

### Requirement 5: Funnel Analysis

**User Story:** As a product manager, I want to see the conversion funnel from registration through
to repeat redemption, so that I can identify where users drop off and prioritise improvements.

#### Acceptance Criteria

1. WHEN `GET /api/admin/analytics/funnel` is requested, THE Analytics_Service SHALL return the
   count of distinct users at each Funnel step: `registered`, `earned_first_reward`,
   `completed_first_redemption`, and `completed_repeat_redemption`.
2. THE Analytics_Service SHALL compute `registered` as the total count of rows in the `users`
   table where `is_deleted = FALSE`.
3. THE Analytics_Service SHALL compute `earned_first_reward` as the count of distinct `user_id`
   values in `point_transactions` where `type = 'earned'`.
4. THE Analytics_Service SHALL compute `completed_first_redemption` as the count of distinct
   `user_id` values in `point_transactions` where `type = 'redeemed'`.
5. THE Analytics_Service SHALL compute `completed_repeat_redemption` as the count of distinct
   `user_id` values that have two or more rows in `point_transactions` where `type = 'redeemed'`.
6. THE Analytics_Service SHALL include `step_conversion_rates` in the response: the fraction of
   users from each step who reached the next step, as floats in [0, 1].
7. WHEN `GET /api/admin/analytics/funnel` is requested with `start_date` and `end_date` query
   parameters, THE Analytics_Service SHALL restrict all step counts to events occurring within
   the specified date range.
8. THE Analytics_Service SHALL cache funnel results under `nova:analytics:funnel:<start>:<end>`
   with a TTL of 300 seconds.

---

### Requirement 6: Cohort Analysis

**User Story:** As a product manager, I want to see retention broken down by user registration
cohort, so that I can compare how different cohorts engage with the platform over time.

#### Acceptance Criteria

1. WHEN `GET /api/admin/analytics/cohorts` is requested with a `granularity` query parameter of
   `week` or `month`, THE Analytics_Service SHALL return a Cohort_Retention_Matrix where each
   row represents a Cohort defined by the truncated `users.created_at` at the requested granularity.
2. THE Analytics_Service SHALL define a user's Cohort as the calendar week (ISO week, Monday start)
   or calendar month in which `users.created_at` falls, depending on the requested granularity.
3. THE Analytics_Service SHALL compute each cell of the Cohort_Retention_Matrix as the fraction of
   the cohort's users who have at least one `analytics_events` or `point_transactions` row in the
   corresponding elapsed period, expressed as a float in [0, 1].
4. THE Analytics_Service SHALL set the period-0 cell (the cohort's formation period) to `1.0` for
   all cohorts with at least one user.
5. WHEN `GET /api/admin/analytics/cohorts` is requested with a `limit` query parameter, THE
   Analytics_Service SHALL return only the most recent `limit` cohorts (default: 12).
6. THE Analytics_Service SHALL cache cohort results under
   `nova:analytics:cohorts:<granularity>:<limit>` with a TTL of 600 seconds.

---

### Requirement 7: Analytics Dashboard API

**User Story:** As an admin, I want a set of authenticated API endpoints that expose all analytics
data in a consistent format, so that I can build a dashboard without writing custom queries.

#### Acceptance Criteria

1. THE Dashboard_API SHALL protect all endpoints under `/api/admin/analytics/` with the
   `authenticateUser` and `requireAdmin` middleware, returning HTTP 401 for unauthenticated
   requests and HTTP 403 for non-admin authenticated requests.
2. WHEN `GET /api/admin/analytics/summary` is requested, THE Analytics_Service SHALL return a
   single JSON object containing: `dau`, `wau`, `mau` (current period counts), `total_events`
   (count of all Analytics_Events), `total_nova_distributed`, `total_nova_redeemed`, and
   `top_campaigns` (the 5 campaigns with the highest `conversion_rate`).
3. THE Dashboard_API SHALL return all responses in the envelope format
   `{ success: true, data: <payload> }` consistent with existing API routes.
4. THE Dashboard_API SHALL accept `start_date` and `end_date` query parameters (ISO 8601) on all
   endpoints that support date filtering, and return HTTP 400 if either value is not a valid date.
5. THE Dashboard_API SHALL accept a `campaign_id` query parameter on the summary endpoint to
   filter `top_campaigns` to a specific merchant's campaigns.
6. THE Metrics_Collector SHALL register an `analytics_events_total` counter with label `event_type`
   and increment it each time an Analytics_Event is persisted successfully.
7. THE Metrics_Collector SHALL expose the `analytics_events_total` counter via the existing
   `GET /metrics` Prometheus endpoint.

---

### Requirement 8: Event Storage Strategy

**User Story:** As a backend engineer, I want a defined storage strategy for analytics events and
derived metrics, so that the analytics system is maintainable, performant, and does not duplicate
data already present in existing tables.

#### Acceptance Criteria

1. THE Event_Store SHALL be implemented as a PostgreSQL table `analytics_events` with columns:
   `id` (SERIAL PK), `event_type` (VARCHAR CHECK constraint on allowed values), `user_id`
   (INTEGER FK → `users.id`), `session_id` (VARCHAR, nullable), `metadata` (JSONB, nullable),
   and `occurred_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).
2. THE Event_Store SHALL have a composite index on `(event_type, occurred_at DESC)` and a
   separate index on `(user_id, occurred_at DESC)` to support the query patterns in Requirements
   2–6.
3. THE Analytics_Service SHALL derive Campaign_Metrics, Revenue_Series, and Funnel step counts
   from the existing `transactions` and `point_transactions` tables rather than duplicating that
   data in `analytics_events`, to avoid double-write inconsistency.
4. THE Analytics_Service SHALL use `analytics_events` exclusively for event types that are not
   already captured in existing tables (`campaign_viewed`, and as the authoritative source for
   `user_registered` and `referral_made` event timestamps).
5. THE Analytics_Service SHALL use parameterised queries for all database interactions to prevent
   SQL injection.
6. WHERE an analytics query aggregates more than 10,000 rows, THE Analytics_Service SHALL use
   cursor-based pagination or streaming to avoid loading the full result set into memory.

---

### Requirement 9: Correctness Properties (Property-Based Testing)

**User Story:** As a backend engineer, I want property-based tests for the analytics service using
fast-check, so that correctness invariants are verified across a wide range of synthetic datasets.

#### Acceptance Criteria

1. FOR ALL sequences of `reward_earned` events emitted for a set of users, the DAU count for any
   given day SHALL equal the count of distinct `user_id` values with at least one event on that
   day (Active_User counting invariant).
2. FOR ALL campaign datasets where `distribution_count >= 0` and `redemption_count >= 0`, the
   computed `Conversion_Rate` SHALL satisfy `0 <= Conversion_Rate <= 1` (conversion rate bounds
   invariant).
3. FOR ALL campaign datasets, the sum of per-campaign `nova_distributed` values SHALL equal the
   total `nova_distributed` returned by the revenue summary (revenue additivity invariant).
4. FOR ALL Funnel datasets, each step count SHALL be less than or equal to the count of the
   preceding step: `repeat_redemption <= first_redemption <= first_reward <= registered`
   (funnel monotonicity invariant).
5. FOR ALL Funnel datasets, each `step_conversion_rate` SHALL be a float in [0, 1]
   (conversion rate bounds invariant).
6. FOR ALL Cohort_Retention_Matrix datasets, the period-0 cell for every cohort with at least one
   user SHALL equal `1.0` (cohort period-0 invariant).
7. FOR ALL Cohort_Retention_Matrix datasets, every cell SHALL be a float in [0, 1]
   (retention bounds invariant).
8. FOR ALL valid Analytics_Events written to the Event_Store, querying by `user_id` and
   `event_type` SHALL return a result set that includes the written event (event round-trip
   property: `insert(e)` then `query(e.user_id, e.event_type)` contains `e`).
9. FOR ALL Revenue_Series responses, the sum of `nova_distributed` across all buckets SHALL equal
   `totals.total_nova_distributed`, and the sum of `nova_redeemed` across all buckets SHALL equal
   `totals.total_nova_redeemed` (revenue series additivity invariant).
10. FOR ALL Analytics_Cache write/read cycles, reading a cached analytics result before TTL expiry
    SHALL return a value deeply equal to the value that was written (analytics cache round-trip
    property).
