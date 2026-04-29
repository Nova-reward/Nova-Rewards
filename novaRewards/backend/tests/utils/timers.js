import { vi } from 'vitest';

export const useFakeTimers = () => vi.useFakeTimers();
export const advanceTimersByTime = (ms) => vi.advanceTimersByTime(ms);
export const restoreTimers = () => vi.useRealTimers();
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// CommonJS interop
module.exports = { useFakeTimers, advanceTimersByTime, restoreTimers, sleep };
