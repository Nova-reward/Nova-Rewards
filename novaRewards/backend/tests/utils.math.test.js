const { clamp, roundTo, percentage, sum, average } = require('../src/utils/math');

describe('math utils', () => {
  describe('clamp', () => {
    it('returns value when within range', () => expect(clamp(5, 1, 10)).toBe(5));
    it('clamps to min', () => expect(clamp(-1, 0, 10)).toBe(0));
    it('clamps to max', () => expect(clamp(20, 0, 10)).toBe(10));
  });

  describe('roundTo', () => {
    it('rounds to 2 decimal places by default', () => expect(roundTo(1.2345)).toBe(1.23));
    it('rounds to specified decimals', () => expect(roundTo(1.2345, 3)).toBe(1.235));
  });

  describe('percentage', () => {
    it('calculates percentage', () => expect(percentage(25, 100)).toBe(25));
    it('returns 0 when total is 0', () => expect(percentage(5, 0)).toBe(0));
  });

  describe('sum', () => {
    it('sums an array', () => expect(sum([1, 2, 3])).toBe(6));
    it('returns 0 for empty array', () => expect(sum([])).toBe(0));
  });

  describe('average', () => {
    it('calculates average', () => expect(average([2, 4, 6])).toBe(4));
    it('returns 0 for empty array', () => expect(average([])).toBe(0));
  });
});
