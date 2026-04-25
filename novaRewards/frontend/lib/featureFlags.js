/**
 * Feature flag helpers.
 *
 * Flags are driven by NEXT_PUBLIC_* environment variables so they are
 * embedded in the browser bundle at build time — no runtime fetch needed.
 *
 * Usage:
 *   import { isEnabled, FLAGS } from '../lib/featureFlags';
 *
 *   if (isEnabled(FLAGS.STAKING))  { ... }
 *
 * Or use the withFeatureFlag HOC / useFeatureFlag hook for components.
 */

// ---------------------------------------------------------------------------
// Flag registry
// ---------------------------------------------------------------------------

/** Canonical flag names — use these constants instead of raw strings. */
export const FLAGS = /** @type {const} */ ({
  STAKING: 'NEXT_PUBLIC_STAKING_ENABLED',
  REFERRAL: 'NEXT_PUBLIC_REFERRAL_ENABLED',
});

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Returns true when the given feature flag is enabled.
 *
 * @param {string} flagName - One of the FLAGS constants.
 * @returns {boolean}
 */
export function isEnabled(flagName) {
  return process.env[flagName] === 'true';
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook that returns whether a feature flag is enabled.
 *
 * Because flags are baked in at build time this never triggers a re-render;
 * it is a hook purely for ergonomic consistency with the rest of the codebase.
 *
 * @param {string} flagName - One of the FLAGS constants.
 * @returns {boolean}
 *
 * @example
 *   const stakingEnabled = useFeatureFlag(FLAGS.STAKING);
 *   if (!stakingEnabled) return null;
 */
export function useFeatureFlag(flagName) {
  return isEnabled(flagName);
}

// ---------------------------------------------------------------------------
// Higher-order component
// ---------------------------------------------------------------------------

/**
 * Wraps a component so it renders null when the given feature flag is off.
 *
 * @template {object} P
 * @param {React.ComponentType<P>} Component
 * @param {string} flagName - One of the FLAGS constants.
 * @returns {React.ComponentType<P>}
 *
 * @example
 *   export default withFeatureFlag(StakingPanel, FLAGS.STAKING);
 */
export function withFeatureFlag(Component, flagName) {
  const displayName = Component.displayName || Component.name || 'Component';

  function FeatureFlagged(props) {
    if (!isEnabled(flagName)) return null;
    return <Component {...props} />;
  }

  FeatureFlagged.displayName = `withFeatureFlag(${displayName})`;
  return FeatureFlagged;
}
