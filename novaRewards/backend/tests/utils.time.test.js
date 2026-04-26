const { isExpired, addDays, toDateString, diffDays, toUnixTimestamp } = require('../src/utils/time');

describe('time utils', () => {
  it('isExpired returns true for past date', () => expect(isExpired('2000-01-01')).toBe(true));
  it('isExpired returns false for future date', () => expect(isExpired('2099-01-01')).toBe(false));

  it('addDays adds days correctly', () => {
    const result = addDays('2026-01-01', 5);
    expect(toDateString(result)).toBe('2026-01-06');
  });

  it('toDateString formats as YYYY-MM-DD', () => {
    expect(toDateString(new Date('2026-03-30T12:00:00Z'))).toBe('2026-03-30');
  });

  it('diffDays returns absolute difference', () => {
    expect(diffDays('2026-01-01', '2026-01-11')).toBe(10);
    expect(diffDays('2026-01-11', '2026-01-01')).toBe(10);
  });

  it('toUnixTimestamp returns seconds', () => {
    const ts = toUnixTimestamp(new Date('2026-01-01T00:00:00Z'));
    expect(ts).toBe(1767225600);
  });
});
