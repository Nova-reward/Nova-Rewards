const { xlmToStroops, stroopsToXlm, pointsToTokens, bytesToHuman, toSafeInt } = require('../src/utils/conversion');

describe('conversion utils', () => {
  it('xlmToStroops', () => {
    expect(xlmToStroops(1)).toBe(10_000_000);
    expect(xlmToStroops(0.5)).toBe(5_000_000);
  });

  it('stroopsToXlm', () => {
    expect(stroopsToXlm(10_000_000)).toBe(1);
    expect(stroopsToXlm(5_000_000)).toBe(0.5);
  });

  it('pointsToTokens', () => {
    expect(pointsToTokens(100, 0.01)).toBeCloseTo(1);
    expect(pointsToTokens(500, 0.005)).toBeCloseTo(2.5);
  });

  it('bytesToHuman', () => {
    expect(bytesToHuman(0)).toBe('0 B');
    expect(bytesToHuman(1024)).toBe('1.00 KB');
    expect(bytesToHuman(1024 * 1024)).toBe('1.00 MB');
  });

  it('toSafeInt', () => {
    expect(toSafeInt('42')).toBe(42);
    expect(toSafeInt('abc')).toBeNull();
    expect(toSafeInt('3.7')).toBe(3);
  });
});
