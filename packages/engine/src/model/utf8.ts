// Counted with native regular-expression scans rather than a loop over code units, so that a
// document near the size limit is measured in milliseconds.
const NON_ASCII = /[\u0080-￿]/;
const TWO_BYTES = /[\u0080-߿]/g;
// Without the u flag, a class matches single code units, so surrogates count here as 3 bytes.
const THREE_BYTES = /[ࠀ-￿]/g;
const PAIR = /[\ud800-\udbff][\udc00-\udfff]/g;

/** How many code units the matches of a global pattern take up. */
const unitsMatching = (text: string, pattern: RegExp): number =>
  text.length - text.replace(pattern, '').length;

/**
 * Whether `text` takes more than `limit` bytes in UTF-8, where a lone surrogate takes the 3 bytes
 * of U+FFFD. A code unit takes 1 byte below U+0080, 2 below U+0800 and 3 above, and a surrogate
 * pair takes 4 for its 2 units.
 */
export function exceedsUtf8Bytes(text: string, limit: number): boolean {
  if (text.length > limit) {
    return true;
  }
  if (text.length * 3 <= limit || !NON_ASCII.test(text)) {
    return false;
  }
  const bytes =
    text.length +
    unitsMatching(text, TWO_BYTES) +
    2 * unitsMatching(text, THREE_BYTES) -
    unitsMatching(text, PAIR);
  return bytes > limit;
}
