import { useEffect, useRef, useState } from 'react';

/**
 * Animates a numeric value from 0 (or its previous value) to `value` using
 * an ease-out curve. Re-triggers whenever `value` changes.
 *
 * @param {object}  props
 * @param {number}  props.value            Target number
 * @param {number}  [props.duration=1200]  Animation duration in ms
 * @param {function} [props.format]        Optional formatter: (n: number) => string
 * @param {string}  [props.className]      CSS class applied to the wrapping <span>
 */
export default function AnimatedCounter({ value, duration = 1200, format, className }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value ?? 0;

    if (from === to) return;

    cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const tick = (now) => {
      if (!startRef.current) startRef.current = now;
      // ease-out: t = 1 - (1 - progress)^3
      const raw = Math.min((now - startRef.current) / duration, 1);
      const t = 1 - Math.pow(1 - raw, 3);
      const current = from + (to - from) * t;

      setDisplay(current);

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = format ? format(display) : display.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return <span className={className}>{formatted}</span>;
}
