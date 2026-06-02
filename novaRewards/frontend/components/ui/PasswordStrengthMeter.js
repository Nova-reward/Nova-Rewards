'use client';
/**
 * PasswordStrengthMeter — Issue #323
 *
 * Visual indicator for password strength using passwordStrengthScore().
 */
import { passwordStrengthScore } from '../../lib/validation';

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
// Colours map to semantic tokens: error → warning → warning → success gradient
const COLOURS = [
  'bg-error-500',    /* 0 — Very weak */
  'bg-warning-500',  /* 1 — Weak      */
  'bg-warning-400',  /* 2 — Fair      */
  'bg-success-500',  /* 3 — Good      */
  'bg-success-600',  /* 4 — Strong    */
];

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const score = passwordStrengthScore(password);

  return (
    <div className="mt-1" aria-live="polite" aria-label={`Password strength: ${LABELS[score]}`}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              'h-1 flex-1 rounded-full transition-colors duration-300',
              i < score ? COLOURS[score] : 'bg-neutral-200 dark:bg-neutral-700',
            ].join(' ')}
          />
        ))}
      </div>
      <p className="mt-0.5 type-caption text-neutral-500 dark:text-neutral-400">{LABELS[score]}</p>
    </div>
  );
}
