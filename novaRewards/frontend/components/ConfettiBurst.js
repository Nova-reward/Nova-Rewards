'use client';

import { useMemo, useEffect } from 'react';

const CONFETTI_COUNT = 200;
const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function ConfettiBurst({ active, onComplete }) {
  const particles = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }).map((_, idx) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * 180;
      const tx = Math.cos(angle) * distance + (Math.random() * 40 - 20);
      const ty = Math.sin(angle) * distance + (Math.random() * 20 - 100);
      const size = 4 + Math.random() * 6;
      const delay = Math.random() * 120;

      return {
        id: `confetti-${idx}`,
        tx,
        ty,
        r: Math.floor(Math.random() * 360),
        size,
        delay,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
      };
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => onComplete?.(), 1400);
    return () => clearTimeout(timeout);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map(({ id, tx, ty, r, size, delay, color, x, y }) => (
        <span
          key={id}
          className="confetti-particle"
          style={{
            left: x,
            top: y,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            transform: `translate(0,0) rotate(${r}deg)`,
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
            '--r': `${r}deg`,
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
