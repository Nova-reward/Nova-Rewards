'use client';
/**
 * PasswordStrengthMeter — Issue #323
 *
 * Visual indicator for password strength using passwordStrengthScore().
 */
import { passwordStrengthScore } from '../../lib/validation';

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
const COLOURS = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500'];

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
              i < score ? COLOURS[score] : 'bg-gray-200',
            ].join(' ')}
          />
        ))}
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{LABELS[score]}</p>
    </div>
  );
}
