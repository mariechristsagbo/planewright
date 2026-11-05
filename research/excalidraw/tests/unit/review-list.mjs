// Reads the list of independent reviews in the checkpoint for the documentation checks. A check
// finds a review by its head and takes counts and ordinals from the list, so recording a later
// review does not break it. A list longer than the words below fails with a clear message instead
// of matching `undefined`.
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');

export const NUMBERS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
];
const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
];

/** The entries of the checkpoint's "Independent reviews" list, in order, as { head, text }. */
export function listedReviews(checkpoint) {
  return checkpoint
    .split('## Independent reviews\n')[1]
    .split(/^## /mu)[0]
    .split(/\n(?=\d+\. \*\*Review of)/u)
    .filter((text) => /^\d+\. \*\*Review of `[0-9a-f]{7}`/u.test(text))
    .map((text) => ({ head: /`([0-9a-f]{7})`/u.exec(text)[1], text }));
}

/** The listed review of `head`, wherever it stands in the list. */
export function reviewByHead(checkpoint, head) {
  const found = listedReviews(checkpoint).find((review) => review.head === head);
  if (!found) throw new Error(`The checkpoint lists no review of ${head}.`);
  return found;
}

/** The number and ordinal words for a count of reviews ("eight", "eighth"). */
export function reviewWords(count) {
  if (!Number.isInteger(count) || count < 1 || count > ORDINALS.length)
    throw new Error(
      `Add number and ordinal words for ${String(count)} reviews to review-list.mjs.`,
    );
  return { number: NUMBERS[count - 1], ordinal: ORDINALS[count - 1] };
}

/** The critical, major and minor findings a listed review reports, from its opening counts. */
export function blockingFindings(review) {
  const counts = /^\d+\. Review of [0-9a-f]{7}: (\d+) critical, (\d+) major, (\d+) minor/u.exec(
    flat(review.text),
  );
  if (!counts) throw new Error(`The review of ${review.head} does not state its counts.`);
  return counts.slice(1).reduce((sum, count) => sum + Number(count), 0);
}

// A bullet, at any depth, that names behaviour-changing commits no listed review covers yet.
const UNREVIEWED = /^\s*- \*\*Not covered by a review\.\*\*/mu;

/**
 * How the latest listed review stands against the R-75 exit rule: its blocking findings, whether
 * the checks of the remediation before it say that this remediation ends at its head (`covers`),
 * whether a remediation of its own is recorded, which would leave a later head unreviewed, and
 * whether the checkpoint names commits that no review covers (`unreviewed`). `reviewMeets` is the
 * review's own verdict: no blocking finding, the head covered and no remediation of its own. `met`
 * also needs no unreviewed commit, so a review that met the rule stays met in its own record
 * while later behaviour-changing commits keep R-75 open.
 */
export function exitRuleState(checkpoint) {
  const reviews = listedReviews(checkpoint);
  const latest = reviews.at(-1);
  const checks = (count) => `## Checks of the ${reviewWords(count).ordinal}-review remediation\n`;
  const before = checkpoint.split(checks(reviews.length - 1))[1] ?? '';
  const covers = flat(before.split(/^## /mu)[0]).includes(`The remediation ends at ${latest.head}`);
  const remediated = checkpoint.includes(checks(reviews.length));
  const unreviewed = UNREVIEWED.test(checkpoint);
  const blocking = blockingFindings(latest);
  const reviewMeets = blocking === 0 && covers && !remediated;
  return {
    head: latest.head,
    blocking,
    covers,
    remediated,
    unreviewed,
    reviewMeets,
    met: reviewMeets && !unreviewed,
  };
}
