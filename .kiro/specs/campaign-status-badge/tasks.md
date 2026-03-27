# Implementation Plan: campaign-status-badge

## Overview

Add a `CampaignStatusBadge` React component that derives and renders a colour-coded, accessible pill badge (Active / Expired / Inactive) for each campaign row in the merchant portal. All changes are purely frontend — no backend modifications required.

## Tasks

- [ ] 1. Add CSS tokens and `.badge-orange` rule to globals.css
  - Add `--badge-orange-bg` and `--badge-orange-text` custom properties to the `:root` block in `novaRewards/frontend/styles/globals.css`
  - Add dark-mode values for both tokens inside the existing `@media (prefers-color-scheme: dark)` block
  - Add a `.badge-orange` rule that applies `background: var(--badge-orange-bg)` and `color: var(--badge-orange-text)`
  - _Requirements: 2.2, 5.1, 5.2, 5.3_

- [ ] 2. Create the CampaignStatusBadge component
  - [ ] 2.1 Implement `CampaignStatusBadge.js` in `novaRewards/frontend/components/`
    - Accept `is_active` (boolean) and `end_date` (string) as props
    - Derive status: if `!is_active` → "Inactive" / `badge-gray`; else if `end_date` is invalid or `new Date(end_date) < new Date()` → "Expired" / `badge-orange`; else → "Active" / `badge-green`
    - Render `<span className={\`badge \${colorClass}\`} aria-label={status}>{status}</span>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

  - [ ]* 2.2 Write unit tests for CampaignStatusBadge
    - Create `novaRewards/frontend/__tests__/CampaignStatusBadge.test.js`
    - Test: renders "Active" + `badge-green` for future `end_date` with `is_active=true`
    - Test: renders "Expired" + `badge-orange` for past `end_date` with `is_active=true`
    - Test: renders "Inactive" + `badge-gray` for `is_active=false` with future `end_date`
    - Test: renders "Inactive" + `badge-gray` for `is_active=false` with past `end_date` (inactive overrides expired)
    - Test: renders "Expired" when `end_date` equals today (same-day boundary)
    - Test: renders "Expired" when `end_date` is missing/invalid and `is_active=true`
    - Test: `aria-label` equals text content for each status
    - Test: `.badge` base class is always present on the rendered element
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

- [ ] 3. Install fast-check and write property-based tests
  - Run `cd novaRewards/frontend && npm install --save-dev fast-check` before writing tests
  - [ ]* 3.1 Write property test for Property 1 — Active inputs produce "Active" and `badge-green`
    - Create `novaRewards/frontend/__tests__/CampaignStatusBadge.property.test.js`
    - Use a `futureDateArb` arbitrary (ISO date string ≥ today) with `is_active=true`
    - Assert text content is "Active" and className contains "badge-green" across ≥ 100 runs
    - **Property 1: Active status derivation and styling**
    - **Validates: Requirements 1.1, 2.1**

  - [ ]* 3.2 Write property test for Property 2 — Expired inputs produce "Expired" and `badge-orange`
    - Use a `pastDateArb` arbitrary (ISO date string < today) with `is_active=true`
    - Assert text content is "Expired" and className contains "badge-orange" across ≥ 100 runs
    - **Property 2: Expired status derivation and styling**
    - **Validates: Requirements 1.2, 2.2**

  - [ ]* 3.3 Write property test for Property 3 — `is_active=false` always produces "Inactive"
    - Use an `anyDateArb` arbitrary (any ISO date string) with `is_active=false`
    - Assert text content is "Inactive" and className contains "badge-gray" across ≥ 100 runs
    - **Property 3: Inactive overrides end_date**
    - **Validates: Requirements 1.3, 2.3**

  - [ ]* 3.4 Write property test for Property 4 — `aria-label` matches visible text
    - Use `fc.boolean()` and `anyDateArb` to cover all input combinations
    - Assert `aria-label` attribute equals `textContent` for every rendered badge across ≥ 100 runs
    - **Property 4: aria-label matches visible text**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.5 Write property test for Property 5 — badge count equals campaign count
    - Use a `campaignListArb` arbitrary that generates lists of N campaign objects (random `is_active` + `end_date`)
    - Render the campaign table section of `merchant.js` (or a minimal wrapper) and assert the number of `.badge` elements equals N across ≥ 100 runs
    - **Property 5: Badge count equals campaign count**
    - **Validates: Requirements 3.1**

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Integrate CampaignStatusBadge into merchant.js
  - [ ] 5.1 Update `novaRewards/frontend/pages/merchant.js` to use the new component
    - Add `import CampaignStatusBadge from "../components/CampaignStatusBadge"` at the top
    - In the campaign table `<tbody>`, replace the inline `<span className={...}>` badge and the `expired` local variable with `<CampaignStatusBadge is_active={c.is_active} end_date={c.end_date} />`
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- fast-check must be installed before running property tests (`npm install --save-dev fast-check` inside `novaRewards/frontend/`)
- The Jest + @testing-library/react setup already exists (see `__tests__/TransactionLink.test.js`); no additional test runner configuration is needed
- Property tests reference design document properties by number for traceability
