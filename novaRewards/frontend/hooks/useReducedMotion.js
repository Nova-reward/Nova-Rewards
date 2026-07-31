'use client';

import { useState, useEffect } from 'react';

/**
 * useReducedMotion — returns true if the user prefers reduced motion.
 *
 * Updates reactively when the OS setting changes.
 * SSR-safe: returns false during server render.
 *
 * @returns {boolean} shouldReduceMotion
 *
 * @example
 * function AnimatedCard() {
 *   const reduceMotion = useReducedMotion();
 *   return (
 *     <div style={{
 *       transition: reduceMotion ? 'none' : 'transform 200ms ease-out',
 *     }}>
 *       ...
 *     </div>
 *   );
 * }
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Set initial value
    setPrefersReducedMotion(mql.matches);

    // Listen for changes (e.g., user toggles OS setting while app is open)
    const handler = (event) => setPrefersReducedMotion(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
