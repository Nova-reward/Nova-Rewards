export function useFakeTimers() {
  if (typeof jest !== 'undefined') {
    return jest.useFakeTimers();
  }
  throw new Error('useFakeTimers requires Jest');
}

export function advanceTimersByTime(ms) {
  if (typeof jest !== 'undefined') {
    return jest.advanceTimersByTime(ms);
  }
  throw new Error('advanceTimersByTime requires Jest');
}

export function restoreRealTimers() {
  if (typeof jest !== 'undefined') {
    return jest.useRealTimers();
  }
  throw new Error('restoreRealTimers requires Jest');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
