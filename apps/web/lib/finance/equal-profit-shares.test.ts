import { describe, expect, it } from 'vitest';
import { splitEqualProfit } from './equal-profit-shares';

describe('equal profit/loss split', () => {
  it.each([0, 2, 5, -2, -5, 17_714_625, -17_714_625, Number.MAX_SAFE_INTEGER])('conserves %s VND', (total) => {
    const [first, second] = splitEqualProfit(total);
    expect(first + second).toBe(total);
    expect(Math.abs(first - second)).toBeLessThanOrEqual(1);
  });
  it('keeps the original first-owner rounding and assigns the residual', () => {
    expect(splitEqualProfit(5)).toEqual([3, 2]);
    expect(splitEqualProfit(-5)).toEqual([-2, -3]);
  });
  it.each([NaN, Infinity, -Infinity])('rejects non-finite %s', (total) => {
    expect(() => splitEqualProfit(total)).toThrow(RangeError);
  });
});
