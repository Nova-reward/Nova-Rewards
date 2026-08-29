import { formatTokenAmount } from '../formatting';

describe('formatTokenAmount', () => {
  describe('zero values', () => {
    it('formats numeric zero with 7 decimals', () => {
      expect(formatTokenAmount(0)).toBe('0.0000000');
    });

    it('formats string zero with 7 decimals', () => {
      expect(formatTokenAmount('0')).toBe('0.0000000');
      expect(formatTokenAmount('0.0000000')).toBe('0.0000000');
    });

    it('formats negative zero as zero', () => {
      expect(formatTokenAmount(-0)).toBe('0.0000000');
    });
  });

  describe('one value', () => {
    it('formats numeric one with 7 decimals', () => {
      expect(formatTokenAmount(1)).toBe('1.0000000');
    });

    it('formats string one with 7 decimals', () => {
      expect(formatTokenAmount('1')).toBe('1.0000000');
    });
  });

  describe('standard decimal values', () => {
    it('pads standard decimals up to 7 decimal places', () => {
      expect(formatTokenAmount(12.345)).toBe('12.3450000');
      expect(formatTokenAmount('100.5')).toBe('100.5000000');
    });

    it('formats values with exactly seven decimals correctly', () => {
      expect(formatTokenAmount(12.3456789)).toBe('12.3456789');
      expect(formatTokenAmount('12.3456789')).toBe('12.3456789');
    });

    it('rounds values with more than seven decimals', () => {
      expect(formatTokenAmount(12.34567891)).toBe('12.3456789');
      expect(formatTokenAmount('12.34567899')).toBe('12.3456790');
    });
  });

  describe('large values with thousands separators', () => {
    it('formats large numbers with commas', () => {
      expect(formatTokenAmount(1234567.89)).toBe('1,234,567.8900000');
      expect(formatTokenAmount('1000000')).toBe('1,000,000.0000000');
    });
  });

  describe('extremely small values (< 0.0000001)', () => {
    it('displays values smaller than 0.0000001 as < 0.0000001', () => {
      expect(formatTokenAmount(0.00000005)).toBe('< 0.0000001');
      expect(formatTokenAmount('0.00000001')).toBe('< 0.0000001');
      expect(formatTokenAmount(1e-8)).toBe('< 0.0000001');
    });

    it('displays exactly 0.0000001 as 0.0000001', () => {
      expect(formatTokenAmount(0.0000001)).toBe('0.0000001');
      expect(formatTokenAmount('0.0000001')).toBe('0.0000001');
    });
  });

  describe('negative values', () => {
    it('formats standard negative values', () => {
      expect(formatTokenAmount(-10.5)).toBe('-10.5000000');
      expect(formatTokenAmount('-1234.5678')).toBe('-1,234.5678000');
    });

    it('formats tiny negative values smaller than threshold', () => {
      expect(formatTokenAmount(-0.00000005)).toBe('-< 0.0000001');
      expect(formatTokenAmount('-0.00000001')).toBe('-< 0.0000001');
    });
  });

  describe('string inputs', () => {
    it('handles numeric string inputs correctly', () => {
      expect(formatTokenAmount('50.25')).toBe('50.2500000');
      expect(formatTokenAmount('0.1000000')).toBe('0.1000000');
    });
  });

  describe('invalid input behavior', () => {
    it('handles null and undefined gracefully', () => {
      expect(formatTokenAmount(null)).toBe('0.0000000');
      expect(formatTokenAmount(undefined)).toBe('0.0000000');
    });

    it('handles empty string and non-numeric string gracefully', () => {
      expect(formatTokenAmount('')).toBe('0.0000000');
      expect(formatTokenAmount('invalid')).toBe('0.0000000');
      expect(formatTokenAmount(NaN)).toBe('0.0000000');
    });

    it('respects custom fallback option when provided', () => {
      expect(formatTokenAmount(null, { fallback: '—' })).toBe('—');
      expect(formatTokenAmount('invalid', { fallback: 'N/A' })).toBe('N/A');
    });
  });

  describe('locale formatting stability', () => {
    it('respects custom locale options', () => {
      // German uses dot for thousands and comma for decimal separator
      expect(formatTokenAmount(1234567.89, { locale: 'de-DE' })).toBe('1.234.567,8900000');
    });
  });

  describe('custom decimals option', () => {
    it('allows overriding decimal places when specified', () => {
      expect(formatTokenAmount(12.3456, { decimals: 2 })).toBe('12.35');
      expect(formatTokenAmount(0.005, { decimals: 2 })).toBe('< 0.01');
    });
  });
});
