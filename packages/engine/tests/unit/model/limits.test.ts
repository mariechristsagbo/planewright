import { describe, expect, it } from 'vitest';

import { CODEC_PROBLEMS } from '../../../src/model/codec.ts';
import { LIMITS } from '../../../src/model/limits.ts';

describe('the codec limits', () => {
  it('REQ-P07 are the limits of the domain model', () => {
    expect(LIMITS).toStrictEqual({
      coordinate: 1e9,
      size: 1e7,
      strokeWidth: 100,
      fontSize: { min: 1, max: 1_000 },
      lineHeight: { min: 1, max: 3 },
      linePoints: 10_000,
      freehandPoints: 50_000,
      text: 100_000,
      link: 2_048,
      elements: 100_000,
      encodedBytes: 50_000_000,
    });
  });
});

describe('the codec problems', () => {
  it('are distinct message keys, with one of their own for a newer schema', () => {
    expect(new Set(CODEC_PROBLEMS).size).toBe(CODEC_PROBLEMS.length);
    expect(CODEC_PROBLEMS).toContain('newer-schema');
    expect(CODEC_PROBLEMS.every((problem) => /^[a-z]+(?:-[a-z]+)*$/.test(problem))).toBe(true);
  });
});
