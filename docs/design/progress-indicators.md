# Progress Indicators — Nova Rewards

**Last Updated:** 2026-07-23

## Components

- `ProgressBar` — horizontal bar (campaign progress, form steps)
- `ProgressCircle` — SVG donut (staking lock period, token vesting)
- `StepIndicator` — wizard steps (onboarding, multi-step form)

All in `components/ui/Progress.jsx`.

## Sizes / Variants

| Component | Sizes | Colors |
|-----------|-------|--------|
| ProgressBar | sm(6px) / md(10px) / lg(16px) | primary / success / warning / error |
| ProgressCircle | 40–128px diameter, configurable strokeWidth | same 4 colors |
| StepIndicator | variant: dots / numbers / bar | primary |

## Animations

- Bar fill: `width` transition `240ms cubic-bezier(0.4,0,0.2,1)` (`.nova-progress-fill`)
- Circle stroke: `stroke-dashoffset` transition `240ms cubic-bezier(0.4,0,0.2,1)`
- Step connector: `background-color` transition `300ms`
- Reduced motion: all transitions set to `none`

## Accessibility

- `ProgressBar`: `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`
- `ProgressCircle`: `role="img"` + `aria-label` on `<figure>`
- `StepIndicator`: `<nav aria-label="Progress steps">`, `aria-current="step"` on active step
- Color never the only differentiator — always paired with label/value
