# Requirements Document

## Introduction

The stellar-drop-modal feature adds a pop-up notification to the Nova Rewards user dashboard that automatically appears when the authenticated user qualifies for a Stellar token drop. On dashboard load, the frontend polls `GET /drops/eligible`; if a drop is available, the modal opens automatically and triggers a full-screen confetti animation. The modal displays the drop details (token amount, expiry date, and eligibility reason) and lets the user claim the drop via `POST /drops/:id/claim`. On a successful claim, the modal shows a success state with the credited amount, dismisses itself, and updates the Points Display Widget with the new balance.

## Glossary

- **Drop**: A one-time allocation of Nova reward tokens granted to a user who meets a specific eligibility criterion, represented by an `id`, `tokenAmount`, `expiryDate`, and `eligibilityReason`.
- **Drop_Modal**: The React modal component that displays drop details, hosts the claim action, and manages its own open/loading/success/error states.
- **Eligibility_Service**: The backend endpoint `GET /drops/eligible` that returns the current eligible drop for the authenticated user, or a response indicating no drop is available.
- **Claim_Service**: The backend endpoint `POST /drops/:id/claim` that processes the claim and returns the credited token amount.
- **Points_Display_Widget**: The existing frontend component that shows the user's current token balance on the dashboard.
- **Confetti_Animation**: A full-screen canvas-based animation (using canvas-confetti or equivalent) triggered when the Drop_Modal opens.
- **Dashboard**: The main authenticated user page that loads on sign-in and hosts the Points_Display_Widget and the Drop_Modal.

## Requirements

### Requirement 1: Eligibility Polling on Dashboard Load

**User Story:** As a user, I want the dashboard to automatically check whether I qualify for a Stellar drop when I open it, so that I never miss a drop I am entitled to.

#### Acceptance Criteria

1. WHEN the Dashboard finishes loading, THE Dashboard SHALL call `GET /drops/eligible` exactly once.
2. WHEN `GET /drops/eligible` returns a drop object, THE Dashboard SHALL open the Drop_Modal with the returned drop data.
3. WHEN `GET /drops/eligible` returns a response indicating no drop is available, THE Dashboard SHALL NOT open the Drop_Modal.
4. IF `GET /drops/eligible` returns an error response, THEN THE Dashboard SHALL silently suppress the error and SHALL NOT open the Drop_Modal.

### Requirement 2: Drop Details Display

**User Story:** As a user, I want to see the details of my eligible drop inside the modal, so that I can make an informed decision before claiming.

#### Acceptance Criteria

1. WHEN the Drop_Modal is open, THE Drop_Modal SHALL display the token amount from the drop object.
2. WHEN the Drop_Modal is open, THE Drop_Modal SHALL display the expiry date from the drop object formatted as a human-readable date string.
3. WHEN the Drop_Modal is open, THE Drop_Modal SHALL display the eligibility reason from the drop object.
4. THE Drop_Modal SHALL render all three fields — token amount, expiry date, and eligibility reason — before the claim action is taken.

### Requirement 3: Confetti Animation on Modal Open

**User Story:** As a user, I want a celebratory animation when the drop modal appears, so that the experience feels rewarding and engaging.

#### Acceptance Criteria

1. WHEN the Drop_Modal opens, THE Confetti_Animation SHALL start a full-screen canvas animation.
2. THE Confetti_Animation SHALL use canvas-confetti or an equivalent canvas-based library.
3. WHEN the Drop_Modal closes, THE Confetti_Animation SHALL stop and clean up any active canvas elements.

### Requirement 4: Claim Action

**User Story:** As a user, I want to claim my drop from within the modal, so that the tokens are credited to my account without leaving the dashboard.

#### Acceptance Criteria

1. WHEN the Drop_Modal is open and no claim is in progress, THE Drop_Modal SHALL display an enabled "Claim" button.
2. WHEN the user clicks "Claim", THE Drop_Modal SHALL call `POST /drops/:id/claim` using the drop's `id`.
3. WHILE a claim request is in flight, THE Drop_Modal SHALL disable the "Claim" button and display a loading spinner in place of the button label.
4. WHILE a claim request is in flight, THE Drop_Modal SHALL prevent duplicate submissions.

### Requirement 5: Claim Success State

**User Story:** As a user, I want to see confirmation of how many tokens were credited after a successful claim, so that I know the drop was applied to my account.

#### Acceptance Criteria

1. WHEN `POST /drops/:id/claim` returns a success response, THE Drop_Modal SHALL transition to a success state.
2. WHEN the Drop_Modal is in the success state, THE Drop_Modal SHALL display the credited token amount returned by the Claim_Service.
3. WHEN the Drop_Modal is in the success state, THE Drop_Modal SHALL automatically dismiss after displaying the success message.
4. WHEN the Drop_Modal dismisses after a successful claim, THE Points_Display_Widget SHALL update to reflect the new token balance.

### Requirement 6: Claim Error Handling

**User Story:** As a user, I want to be informed if my claim fails, so that I can try again or understand what went wrong.

#### Acceptance Criteria

1. IF `POST /drops/:id/claim` returns an error response, THEN THE Drop_Modal SHALL display a descriptive error message.
2. IF `POST /drops/:id/claim` returns an error response, THEN THE Drop_Modal SHALL re-enable the "Claim" button so the user can retry.
3. IF `POST /drops/:id/claim` returns an error response, THEN THE Drop_Modal SHALL NOT dismiss.

### Requirement 7: Modal Dismissal

**User Story:** As a user, I want to be able to close the drop modal without claiming, so that I can return to the dashboard freely.

#### Acceptance Criteria

1. WHEN the Drop_Modal is open and no claim is in progress, THE Drop_Modal SHALL provide a visible dismiss control (e.g., a close button or backdrop click).
2. WHEN the user activates the dismiss control, THE Drop_Modal SHALL close without calling `POST /drops/:id/claim`.
3. WHILE a claim request is in flight, THE Drop_Modal SHALL disable the dismiss control to prevent accidental closure.

### Requirement 8: Accessibility

**User Story:** As a user relying on assistive technology, I want the drop modal to be fully navigable by keyboard and screen reader, so that I can claim my drop without using a mouse.

#### Acceptance Criteria

1. WHEN the Drop_Modal opens, THE Drop_Modal SHALL move focus to the modal container.
2. WHILE the Drop_Modal is open, THE Drop_Modal SHALL trap keyboard focus within the modal.
3. WHEN the Drop_Modal closes, THE Drop_Modal SHALL return focus to the element that triggered it.
4. THE Drop_Modal SHALL include an `aria-modal="true"` attribute and a descriptive `aria-label` or `aria-labelledby` referencing the modal title.
5. THE Drop_Modal SHALL associate the loading spinner with the "Claim" button via `aria-busy` so screen readers announce the in-progress state.
