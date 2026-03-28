# Animation Spec: Nova Rewards UI

## 1) Button interactions

### Press state
- scale: 0.97
- duration: 80ms
- easing: ease-out
- occurs on `:active` and programmatic click feedback.

### Hover state
- property: background-color (and optional box-shadow / color).
- duration: 150ms
- easing: ease

### Focus ring
- outline/focus ring fade-in.
- duration: 100ms
- easing: ease-out
- triggered on `:focus-visible`.

## 2) Loading states

### Skeleton shimmer
- element: `placeholder` style.
- animation: linear gradient sweep (left to right).
- duration: 1.5s
- iteration: infinite
- timing: linear

### Spinner
- SVG-based spinner mark-up.
- `spin` @keyframes: 0deg -> 360deg
- duration: 400ms
- iteration: infinite
- timing: linear

### Progress bar
- fill width from 0 to 100%.
- transition duration: 240ms (or token value).
- easing: cubic-bezier(0.4, 0, 0.2, 1)

## 3) Confetti burst for Claim Drop modal
- particles: 200
- duration: 1.2s
- easing: ease-out (deceleration)
- split between CSS particle elements + JS trigger.
- relative implementation: in component, instantiate particle nodes + random vectors.

## 4) Points-counter increment (lottie)
- implement as `Lottie` JSON asset:
  - from 0% to 100% with number and pop scale.
  - 700ms total.
- path: `docs/design/points-counter-increment.json`
- use in React:
  - `import animationData from "../docs/design/points-counter-increment.json";`
  - `<Lottie animationData={animationData} loop={false} />`

## 5) CSS animation tokens
- centralize values in `docs/design/animation-tokens.css`.
- use these custom properties in component CSS.

## 6) CSS-only vs JS-driven decision (recommendations)

### CSS-only
- button state transitions (`hover`, `active`, `focus`)
- skeleton shimmer, spinner, progress easing
- small micro interactions in controls

### JS-driven
- claim-drop confetti burst (burst of 200 particles + end cleanup)
- points-counter increment high-fidelity Lottie control + dynamic value sync
- advanced composited animations where lifecycle is tied to state

### Team review
- [ ] Share this spec at next frontend standup.
- [ ] Confirm that button interaction, skeleton, spinner, and progress bars stay CSS-only.
- [ ] Confirm that confetti burst and points-counter Lottie are JS-driven.
- [ ] Record any exceptions (heavy animation offload, intersection triggers, frame-drop handling).

> Action item: Review with frontend team in next sync and agree on final candidate splits. Add notes to `docs/design/animation-spec.md` and update storybook stories.
