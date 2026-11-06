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
  'fourteen',
  'fifteen',
  'sixteen',
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
  'fourteenth',
  'fifteenth',
  'sixteenth',
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

// The checkpoint sections that record work a review covers and that is not a review remediation.
const OTHER_WORK = ['Netlog placement (R-64, R-66)'];

// The flattened text of a checkpoint section, or '' when there is none.
const sectionText = (checkpoint, title) =>
  flat((checkpoint.split(`## ${title}\n`)[1] ?? '').split(/^## /mu)[0]);

// Whether the work that the review numbered `count` covers ends at `head`: the checks of the
// remediation of the review before it say so, or a section of other work does.
function covered(checkpoint, count, head) {
  const remediation = `Checks of the ${reviewWords(count - 1).ordinal}-review remediation`;
  return (
    sectionText(checkpoint, remediation).includes(`The remediation ends at ${head}`) ||
    OTHER_WORK.some((title) => sectionText(checkpoint, title).includes(`The work ends at ${head}`))
  );
}

/**
 * How the listed review of `head` stands on its own against the R-75 exit rule, wherever it is in
 * the list: its blocking findings, whether the record of the work it covers says that this work
 * ends at its head (`covers`), whether a remediation of its own is recorded (`remediated`), which
 * would leave a later head unreviewed, and its own verdict (`reviewMeets`): no blocking finding,
 * the head covered and no remediation of its own.
 */
export function reviewState(checkpoint, head) {
  const count = listedReviews(checkpoint).findIndex((review) => review.head === head) + 1;
  const blocking = blockingFindings(reviewByHead(checkpoint, head));
  const covers = covered(checkpoint, count, head);
  const remediated = checkpoint.includes(
    `## Checks of the ${reviewWords(count).ordinal}-review remediation\n`,
  );
  return {
    head,
    blocking,
    covers,
    remediated,
    reviewMeets: blocking === 0 && covers && !remediated,
  };
}

/**
 * How the latest listed review stands against the R-75 exit rule: its own state (reviewState),
 * whether the checkpoint names commits that no review covers (`unreviewed`), and `met`, which also
 * needs no unreviewed commit, so a review that met the rule stays met in its own record while
 * later behaviour-changing commits keep R-75 open.
 */
export function exitRuleState(checkpoint) {
  const state = reviewState(checkpoint, listedReviews(checkpoint).at(-1).head);
  const unreviewed = UNREVIEWED.test(checkpoint);
  return { ...state, unreviewed, met: state.reviewMeets && !unreviewed };
}
