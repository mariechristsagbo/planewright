// Reads the list of independent reviews in the checkpoint for the documentation checks. A check
// finds a review by its head and takes counts and ordinals from the list, so recording a later
// review does not break it. A list longer than the words below fails with a clear message instead
// of matching `undefined`.
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
