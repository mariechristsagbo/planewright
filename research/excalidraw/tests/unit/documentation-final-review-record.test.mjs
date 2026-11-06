// Checks the record of the final independent review against itself and the checkpoint: the
// counts it opens with match the findings it lists, each major finding names the commit that
// remediates it, the minor findings and suggestions are open, and the checkpoint's list entry and
// the readiness record give the same counts, commits and handling.
import { describe, expect, it } from 'vitest';

import { RE, flat, read } from './r76-evidence.mjs';
import { blockingFindings, exitRuleState, reviewByHead } from './review-list.mjs';

const HEAD = 'cd1694c';
const record = () => read(`${RE}/final-review.md`);
const part = (heading) => record().split(`## ${heading}\n`)[1].split(/^## /mu)[0];
// The numbered items of a section, each flattened.
const items = (heading) =>
  part(heading)
    .split(/\n(?=\d+\. )/u)
    .filter((text) => /^\d+\. /u.test(text))
    .map(flat);
const commitsOf = (text) => [...text.matchAll(/\b[0-9a-f]{7}\b/gu)].map(([sha]) => sha);

describe('the record of the final independent review', () => {
  it('opens with the counts of the findings it lists', () => {
    const [majors, minors, suggestions] = [
      items('Major findings, remediated'),
      items('Minor findings, open'),
      items('Suggestions, open'),
    ];
    expect(flat(record())).toContain(
      `ran once, read-only, on head ${HEAD} on 2026-11-06, in a separate Claude Code session`,
    );
    expect(flat(record())).toContain(
      `It reported 0 critical, ${String(majors.length)} major and ${String(minors.length)} minor ` +
        `findings and ${String(suggestions.length)} suggestions, so it does not meet the R-75 exit rule`,
    );
    expect(flat(part('Minor findings, open')).trim()).toMatch(/^Each stays open and non-blocking/u);
    const entry = reviewByHead(read(`${RE}/checkpoint.md`), HEAD);
    expect(blockingFindings(entry)).toBe(majors.length + minors.length);
    expect(flat(entry.text)).toContain(
      `0 critical, ${String(majors.length)} major, ${String(minors.length)} minor findings and ` +
        `${String(suggestions.length)} suggestions`,
    );
  });

  it('names the remediating commit of each major finding, there and in the readiness record', () => {
    const majors = items('Major findings, remediated');
    const fixes = majors.map((text) => /Remediated in ([0-9a-f]{7})/u.exec(text)?.[1]);
    expect(fixes.every(Boolean)).toBe(true);
    expect(new Set(fixes).size).toBe(majors.length);
    const entry = flat(reviewByHead(read(`${RE}/checkpoint.md`), HEAD).text);
    expect(commitsOf(entry.split('Majors 1 and 2 are remediated')[1])).toEqual(
      expect.arrayContaining(fixes),
    );
    const readiness = flat(read(`${RE}/readiness.md`)).split('Decided by the maintainer.')[1];
    expect(readiness).toContain(`the two major findings were remediated (${fixes.join(', ')})`);
    expect(readiness).toContain('stay open, non-blocking, for the feature work that follows');
    // The remediation is behaviour-changing and unreviewed, so R-75 stays open.
    expect(exitRuleState(read(`${RE}/checkpoint.md`))).toMatchObject({ head: HEAD, met: false });
  });
});
