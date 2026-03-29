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

## 7) Page transitions

### Route changes
- Fade out current page: opacity 1 to 0, duration 200ms, easing ease-out
- Slide in new page: transform translateX(100%) to 0, duration 300ms, easing cubic-bezier(0.4, 0, 0.2, 1)
- Stagger content appearance: delay 100ms for main content, 200ms for secondary

### Modal transitions
- Backdrop fade: opacity 0 to 0.5, duration 200ms, easing ease
- Modal slide up: transform translateY(20px) to 0, opacity 0 to 1, duration 250ms, easing cubic-bezier(0.34, 1.56, 0.64, 1)
- Close: reverse animations

## 8) Micro-interactions

### Form field focus
- Border color change: duration 150ms, easing ease
- Label float up: transform translateY, scale, duration 200ms, easing cubic-bezier(0.4, 0, 0.2, 1)

### Icon hover
- Scale: 1 to 1.1, duration 150ms, easing ease-out
- Color transition: duration 200ms, easing ease

### Notification toast
- Slide in from right: transform translateX(100%) to 0, duration 300ms, easing cubic-bezier(0.4, 0, 0.2, 1)
- Auto dismiss: fade out after 3s, duration 200ms

## 9) Hover, loading, success, and error animations

### Hover animations
- Card lift: box-shadow increase, transform translateY(-2px), duration 200ms, easing ease
- Tooltip appear: opacity 0 to 1, transform scale(0.95) to 1, duration 150ms, easing ease-out

### Loading animations
- Pulse: opacity 0.5 to 1, duration 1s, iteration infinite, easing ease-in-out
- Bounce: transform translateY(0) to -10px to 0, duration 600ms, iteration infinite

### Success animations
- Checkmark draw: SVG path stroke-dashoffset from 100 to 0, duration 400ms, easing ease-out
- Success message slide down: transform translateY(-20px) to 0, opacity 0 to 1, duration 300ms

### Error animations
- Shake: transform translateX(-5px) to 5px repeated, duration 400ms, easing ease-in-out
- Error border flash: border-color red, duration 200ms, repeat 3 times

## 10) Performance-optimized animation guidelines

### Use transform and opacity
- Prefer transform (translate, scale, rotate) and opacity for animations as they don't trigger layout recalculations
- Avoid animating properties like width, height, top, left that cause reflows

### Limit animation scope
- Use will-change CSS property for elements that will animate to hint browser for optimization
- Remove will-change after animation completes

### Reduce motion for accessibility
- Respect prefers-reduced-motion media query: disable animations for users who prefer reduced motion
- Provide alternative static states

### Optimize for 60fps
- Keep animations under 16ms per frame
- Use requestAnimationFrame for JS animations
- Avoid heavy computations during animation frames

### Hardware acceleration
- Use transform3d for GPU acceleration when possible
- Be cautious with too many layered animations

### Testing
- Test animations on low-end devices
- Use Chrome DevTools performance tab to monitor frame drops
- Ensure animations don't interfere with user interactions
