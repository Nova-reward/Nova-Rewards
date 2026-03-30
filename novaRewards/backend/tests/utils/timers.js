function useFakeTimers() {
  if (typeof jest !== 'undefined') {
    return jest.useFakeTimers();
  }
  throw new Error('useFakeTimers requires Jest');
}

function advanceTimersByTime(ms) {
  if (typeof jest !== 'undefined') {
    return jest.advanceTimersByTime(ms);
  }
  throw new Error('advanceTimersByTime requires Jest');
}

function restoreTimers() {
  if (typeof jest !== 'undefined') {
    return jest.useRealTimers();
  }
  throw new Error('restoreTimers requires Jest');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  useFakeTimers,
  advanceTimersByTime,
  restoreTimers,
  sleep,
};
