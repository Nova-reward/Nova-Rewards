import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnimatedCounter from '../components/ui/AnimatedCounter';

// Controllable rAF mock: each flush call invokes pending callbacks with the given timestamp.
let rafCallbacks = [];
let rafId = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = ++rafId;
    rafCallbacks.push({ id, cb });
    return id;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => {
    rafCallbacks = rafCallbacks.filter((r) => r.id !== id);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Run one batch of pending rAF callbacks at `timestamp`.
 * Does NOT loop — call multiple times to advance through frames.
 */
function stepRaf(timestamp) {
  act(() => {
    const batch = [...rafCallbacks];
    rafCallbacks = [];
    batch.forEach(({ cb }) => cb(timestamp));
  });
}

describe('AnimatedCounter', () => {
  test('renders 0 before any animation frame fires', () => {
    render(<AnimatedCounter value={100} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('reaches the target value after animation completes', () => {
    render(<AnimatedCounter value={500} duration={1200} />);
    // Frame 1: sets startRef = 0, raw = 0
    stepRaf(0);
    // Frame 2: raw = 1200/1200 = 1 → animation ends
    stepRaf(1200);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  test('animates from 0 (intermediate frame shows partial value)', () => {
    render(<AnimatedCounter value={1000} duration={1200} />);
    stepRaf(0);    // sets startRef = 0
    stepRaf(600);  // raw = 0.5, ease-out t ≈ 0.875 → ~875
    const text = document.querySelector('span').textContent.replace(/,/g, '');
    const num = parseFloat(text);
    expect(num).toBeGreaterThan(0);
    expect(num).toBeLessThan(1000);
  });

  test('handles decimal values via custom format', () => {
    render(<AnimatedCounter value={12.5} duration={1200} format={(v) => v.toFixed(2)} />);
    stepRaf(0);
    stepRaf(1200);
    expect(screen.getByText('12.50')).toBeInTheDocument();
  });

  test('handles large numbers (1M+)', () => {
    render(<AnimatedCounter value={2_500_000} duration={1200} />);
    stepRaf(0);
    stepRaf(1200);
    const text = document.querySelector('span').textContent.replace(/[,\s]/g, '');
    expect(parseFloat(text)).toBeCloseTo(2_500_000, -3);
  });

  test('applies className to the span', () => {
    render(<AnimatedCounter value={42} className="my-counter" />);
    expect(document.querySelector('span.my-counter')).toBeInTheDocument();
  });

  test('re-triggers animation when value prop changes', () => {
    const { rerender } = render(<AnimatedCounter value={100} duration={1200} />);
    stepRaf(0);
    stepRaf(1200);
    expect(screen.getByText('100')).toBeInTheDocument();

    rerender(<AnimatedCounter value={200} duration={1200} />);
    // Before any new frame, display still shows 100
    expect(screen.getByText('100')).toBeInTheDocument();

    stepRaf(2000);   // sets startRef = 2000
    stepRaf(3200);   // raw = 1200/1200 = 1 → reaches 200
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  test('uses default duration of 1200ms', () => {
    render(<AnimatedCounter value={99} />);
    stepRaf(0);
    stepRaf(1200);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  test('custom format function receives the animated float', () => {
    const format = jest.fn((v) => `$${Math.round(v)}`);
    render(<AnimatedCounter value={50} duration={1200} format={format} />);
    stepRaf(0);
    stepRaf(1200);
    expect(format).toHaveBeenCalled();
    expect(screen.getByText('$50')).toBeInTheDocument();
  });

  test('does not animate when value is 0', () => {
    render(<AnimatedCounter value={0} />);
    // from === to (both 0), no rAF scheduled
    expect(rafCallbacks).toHaveLength(0);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
