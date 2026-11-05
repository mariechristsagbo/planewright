// Checks the record of the review of 6d5d264, found by its head: its counts, session, range,
// verification, limits and verdict, its four suggestions left open, where the twelfth-review
// remediation ends, that the review meets the exit rule on its own while the other criteria and
// issue #1 stay open, and the checks of this record. R-75 after the later netlog placement is
// checked in documentation-netlog-placement-record.test.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { exitRuleState, listedReviews, reviewByHead } from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
// The names of the rows of a checkpoint status table whose status is `status`, in table order.
const withStatus = (title, status) =>
  section(title)
    .split('\n')
    .filter((line) => /^\| [^-]/u.test(line))
    .slice(1)
    .map((line) => line.split('|').map((cell) => flat(cell).trim()))
    .filter((cells) => cells[2] === status)
    .map((cells) => cells[1]);
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'))
    .split('|')
    .map((cell) => flat(cell).trim());

// The suggestions of the review of 6d5d264, each with a term that its bullet names.
const SUGGESTIONS = {
  'Suggestion 1': 'documentation-twelfth-review.test.mjs',
  'Suggestion 2': 'driverOverlap',
  'Suggestion 3': 'research README',
  'Suggestion 4': 'integration fixtures',
};

describe('the record of the review of 6d5d264', () => {
  const text = () => reviewByHead(checkpoint(), '6d5d264').text;
  const entry = () => flat(text());
  // The bullet of the entry that handles `finding`, flattened.
  const bullet = (finding) =>
    flat(
      text()
        .split(/\n +- /u)
        .find((part) => part.startsWith(`**${finding},`)) ?? '',
    );

  it('lists it thirteenth, with its counts, verdict, session and range', () => {
    expect(
      listedReviews(checkpoint())
        .map((r) => r.head)
        .indexOf('6d5d264'),
    ).toBe(12);
    expect(entry()).toMatch(
      /^13\. Review of 6d5d264: 0 critical, 0 major, 0 minor findings and 4 suggestions\. It meets the R-75 exit rule: it covers 6d5d264, where the twelfth-review remediation ends, and the commits after it up to c010f7e only record this review\./u,
    );
    expect(entry()).toContain('the twelfth-review remediation 4e9c663..6d5d264 read-only');
    expect(entry()).toContain(
      'd11b620a-52a1-46b1-a58a-d11543ca9b4a, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
    expect(entry()).toContain('only through allowlisting wrappers');
  });

  it('records what it verified, with the regeneration as it ran', () => {
    expect(entry()).toContain('npm run validate on 6d5d264 (44 test files and 562 tests');
    expect(entry()).toContain('It compared 7 of them byte for byte after Prettier');
    expect(entry()).toContain(
      'by a canonical jq -c digest, because a redirect to a file and Prettier on stdin were refused.',
    );
    expect(entry()).toMatch(
      /For those 10 it argued from their layout that Prettier would give the same bytes[^;]*; it ran no literal comparison of them\./u,
    );
    expect(entry()).not.toMatch(/all 17\b[^.]*byte for byte/u);
    expect(entry()).toMatch(/28 sabotage runs[^.]*26 failed a test[^.]*Suggestion 1/u);
    expect(entry()).toContain('PR #2 a Draft with all 8 check runs succeeded on 6d5d264');
  });

  it('records what it did not run or verify', () => {
    expect(entry()).toMatch(
      /It did not run isolation-check\.sh or selftest\.sh[^;]*; ran no live session, driver\.mjs or run\.mjs; called no REA tool/u,
    );
    expect(entry()).toContain('because git ls-remote needed approval');
    expect(entry()).toContain("It did not verify the twelfth review's session ID and model");
  });

  it('lists its four suggestions as open and not addressed', () => {
    expect(entry()).toContain('Suggestions 1–4 are not addressed in this record.');
    for (const [finding, term] of Object.entries(SUGGESTIONS))
      expect(bullet(finding), finding).toContain(term);
    expect(entry()).toContain('Suggestions 2–10 of the review of a85eb82 stay open');
    expect(entry()).toMatch(/would be behaviour-changing[^.]*fresh review under the rule/u);
  });
});

describe('the review of 6d5d264 against the exit rule', () => {
  it('ends the twelfth-review remediation at 6d5d264, the head the review covers', () => {
    expect(flat(section('Checks of the twelfth-review remediation'))).toContain(
      'The remediation ends at 6d5d264, the commit that adds this section',
    );
    expect(exitRuleState(checkpoint())).toMatchObject({
      head: '6d5d264',
      blocking: 0,
      covers: true,
      remediated: false,
      reviewMeets: true,
    });
  });

  it('keeps its suggestions in the R-75 row, and leaves the other criteria and issue #1 open', () => {
    expect(r75()[6]).toContain('6d5d264');
    expect(r75()[7]).toContain(
      'Its 4 suggestions stay open, with their handling in the checkpoint',
    );
    expect(withStatus('Acceptance criteria', 'Partial')).toEqual([
      'feature-inventory.md covers all discovered features',
      'behavior-analysis.md',
      'limitations.md',
      'Desktop light/dark and mobile evidence sets',
      'Canvas interactions through the external driver while REA observes',
      'Prioritised backlog with acceptance criteria',
    ]);
    expect(withStatus('Testing requirements', 'Partial')).toEqual(
      expect.arrayContaining([
        'Re-run each documented interaction from a fresh profile',
        'Generated JSON and REA bundles validated',
      ]),
    );
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});

describe('the checks of the thirteenth-review record', () => {
  const checks = () => flat(section('Checks of the thirteenth-review record'));

  it('name what changed, what ran and what did not', () => {
    expect(checks()).toContain(
      'This record changes only the checkpoint, the residual matrix, the record checks and the ' +
        'number words of review-list.mjs.',
    );
    expect(checks()).toContain('none of the four suggestions is addressed');
    expect(checks()).toMatch(/npm run validate passed on 668d79b[^.]*45 test files and 565 tests/u);
    expect(checks()).toContain('in a temporary copy outside the repository');
    expect(checks()).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(checks()).toMatch(/selftest\.sh were not run again/u);
    expect(checks()).toContain('no live session ran');
  });
});
