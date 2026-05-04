import { describe, it, expect } from 'vitest';
import { aggregateExitCode } from '../src/exit-code.js';

describe('aggregateExitCode', () => {
  it('empty array → 0', () => expect(aggregateExitCode([])).toBe(0));
  it('all zeros → 0', () => expect(aggregateExitCode([0, 0, 0])).toBe(0));

  // Single-code identity
  it('[1] → 1', () => expect(aggregateExitCode([1])).toBe(1));
  it('[2] → 2', () => expect(aggregateExitCode([2])).toBe(2));
  it('[3] → 3', () => expect(aggregateExitCode([3])).toBe(3));
  it('[4] → 4', () => expect(aggregateExitCode([4])).toBe(4));
  it('[5] → 5', () => expect(aggregateExitCode([5])).toBe(5));

  // Priority: 5 > 4 > 2 > 3 > 1 > 0
  it('5 beats everything', () => expect(aggregateExitCode([0, 1, 2, 3, 4, 5])).toBe(5));
  it('4 beats 2, 3, 1, 0', () => expect(aggregateExitCode([0, 1, 2, 3, 4])).toBe(4));
  it('2 beats 3', () => expect(aggregateExitCode([3, 2])).toBe(2));
  it('2 beats 3 and 1', () => expect(aggregateExitCode([1, 3, 2])).toBe(2));
  it('3 beats 1', () => expect(aggregateExitCode([1, 3])).toBe(3));
  it('1 beats 0', () => expect(aggregateExitCode([0, 1])).toBe(1));

  // Mixed kill results
  it('killed + free → 1 (not-in-use wins)', () => expect(aggregateExitCode([0, 1])).toBe(1));
  it('killed + permission → 2', () => expect(aggregateExitCode([0, 2])).toBe(2));
  it('cancelled + permission → 2', () => expect(aggregateExitCode([3, 2])).toBe(2));
  it('all killed → 0', () => expect(aggregateExitCode([0, 0, 0])).toBe(0));
});
