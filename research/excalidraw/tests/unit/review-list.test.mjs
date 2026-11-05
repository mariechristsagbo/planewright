// Checks the number and ordinal words of review-list.mjs, that a checkpoint listing fourteen
// reviews is read to its last entry, which the record checks need once a fourteenth review is
// recorded, that the latest review's own verdict is kept apart from later commits that no review
// covers, and that any listed review keeps its own state whatever review comes after it.
import { describe, expect, it } from 'vitest';

import { exitRuleState, listedReviews, reviewState, reviewWords } from './review-list.mjs';

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
  it('name every count up to fourteen reviews', () => {
    expect(reviewWords(13)).toEqual({ number: 'thirteen', ordinal: 'thirteenth' });
    expect(reviewWords(14)).toEqual({ number: 'fourteen', ordinal: 'fourteenth' });
  });

  it('fail with a clear message past the last word', () => {
    expect(() => reviewWords(15)).toThrow(
      'Add number and ordinal words for 15 reviews to review-list.mjs.',
    );
  });
});

describe('a checkpoint that lists fourteen reviews', () => {
  it('is read to its fourteenth entry and the state of the exit rule', () => {
    const text = record(14);
    expect(listedReviews(text)).toHaveLength(14);
    expect(exitRuleState(text)).toMatchObject({
      head: '000000e',
      blocking: 0,
      covers: true,
      remediated: false,
      unreviewed: false,
      met: true,
    });
  });
});

describe("the latest review's own verdict and the commits after it", () => {
  it('keeps a review that meets the rule apart from later commits that no review covers', () => {
    const later = `${record(2)}- **Not covered by a review.** Later commits.\n`;
    expect(exitRuleState(record(2))).toMatchObject({ reviewMeets: true, met: true });
    expect(exitRuleState(later)).toMatchObject({
      head: '0000002',
      blocking: 0,
      unreviewed: true,
      reviewMeets: true,
      met: false,
    });
  });

  it('does not let a review with a finding, or one left uncovered, meet the rule', () => {
    const minor = record(2).replace(
      '2. **Review of `0000002`**: 0 critical, 0 major, 0 minor',
      '2. **Review of `0000002`**: 0 critical, 0 major, 1 minor',
    );
    const uncovered = record(2).replace('The remediation ends at 0000002', 'It ends elsewhere');
    for (const text of [minor, uncovered])
      expect(exitRuleState(text)).toMatchObject({ reviewMeets: false, met: false });
  });
});

describe('a review that covers work recorded in its own section', () => {
  // Fourteen clean reviews, the last of which covers work in `title`, not a remediation.
  const other = (sentence, title = 'Netlog placement (R-64, R-66)') =>
    record(14).replace(
      '## Checks of the thirteenth-review remediation\n- The remediation ends at 000000e.',
      `## ${title}\n- ${sentence}.`,
    );

  it('reads where the netlog placement ends as the head the latest review covers', () => {
    const text = other('The work ends at 000000e');
    expect(text).not.toContain('-review remediation');
    expect(exitRuleState(text)).toMatchObject({
      head: '000000e',
      covers: true,
      reviewMeets: true,
      met: true,
    });
  });

  it('needs that section to end the work at the latest head, in its own words', () => {
    for (const text of [
      other('The work ends at 000000d'),
      other('The remediation ends at 000000e'),
      other('The work ends at 000000e', 'Other work'),
    ])
      expect(exitRuleState(text)).toMatchObject({ head: '000000e', covers: false, met: false });
  });
});

describe('the state of any listed review', () => {
  // Review 2 had a minor finding and is remediated up to 0000003, which review 3 covers.
  const text = [
    '# Checkpoint',
    '## Checks of the first-review remediation',
    '- The remediation ends at 0000002.',
    '## Checks of the second-review remediation',
    '- The remediation ends at 0000003.',
    '## Independent reviews',
    '1. **Review of `0000001`**: 0 critical, 1 major, 0 minor findings.',
    '2. **Review of `0000002`**: 0 critical, 0 major, 1 minor findings.',
    '3. **Review of `0000003`**: 0 critical, 0 major, 0 minor findings.',
    '',
  ].join('\n');

  it('keeps an earlier review to its own verdict, whatever review comes after it', () => {
    expect(reviewState(text, '0000002')).toEqual({
      head: '0000002',
      blocking: 1,
      covers: true,
      remediated: true,
      reviewMeets: false,
    });
    expect(reviewState(text, '0000003')).toEqual({
      head: '0000003',
      blocking: 0,
      covers: true,
      remediated: false,
      reviewMeets: true,
    });
    expect(exitRuleState(text)).toEqual({
      ...reviewState(text, '0000003'),
      unreviewed: false,
      met: true,
    });
  });

  it('refuses a head that the list does not name', () => {
    expect(() => reviewState(text, 'fffffff')).toThrow(
      'The checkpoint lists no review of fffffff.',
    );
  });
});
