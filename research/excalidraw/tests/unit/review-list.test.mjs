// Checks the number and ordinal words of review-list.mjs and that a checkpoint listing thirteen
// reviews is read to its last entry, which the record checks need once a thirteenth review is
// recorded.
import { describe, expect, it } from 'vitest';

import { exitRuleState, listedReviews, reviewWords } from './review-list.mjs';

// A minimal checkpoint listing `count` clean reviews, whose last remediation ends at the last head.
const record = (count) => {
  const heads = Array.from({ length: count }, (_, n) => (n + 1).toString(16).padStart(7, '0'));
  return [
    '# Checkpoint',
    `## Checks of the ${reviewWords(count - 1).ordinal}-review remediation`,
    `- The remediation ends at ${heads.at(-1)}.`,
    '## Independent reviews',
    ...heads.map(
      (head, n) =>
        `${String(n + 1)}. **Review of \`${head}\`**: 0 critical, 0 major, 0 minor findings.`,
    ),
    '## Later work',
    '',
  ].join('\n');
};

describe('the review words', () => {
  it('name every count up to thirteen reviews', () => {
    expect(reviewWords(12)).toEqual({ number: 'twelve', ordinal: 'twelfth' });
    expect(reviewWords(13)).toEqual({ number: 'thirteen', ordinal: 'thirteenth' });
  });

  it('fail with a clear message past the last word', () => {
    expect(() => reviewWords(14)).toThrow(
      'Add number and ordinal words for 14 reviews to review-list.mjs.',
    );
  });
});

describe('a checkpoint that lists thirteen reviews', () => {
  it('is read to its thirteenth entry and the state of the exit rule', () => {
    const text = record(13);
    expect(listedReviews(text)).toHaveLength(13);
    expect(exitRuleState(text)).toMatchObject({
      head: '000000d',
      blocking: 0,
      covers: true,
      remediated: false,
      unreviewed: false,
      met: true,
    });
  });
});
