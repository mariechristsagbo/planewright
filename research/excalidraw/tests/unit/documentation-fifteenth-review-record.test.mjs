// Checks the record of the review of a9a4619, found by its head: its counts, session, range,
// verification, limits and verdict, its three suggestions left open, where the fourteenth-review
// remediation ends, that the review meets the exit rule and closes R-75 and the review
// requirement at this record while the PR stays a Draft and the other criteria and issue #1 stay
// open, and the checks of this record.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listedReviews, reviewByHead, reviewState } from './review-list.mjs';
import { COMMITTED_AFTER_DB16323 } from './r76-evidence.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
const sessions = () =>
  JSON.parse(read('docs/reverse-engineering/evidence/netlog-steps.json')).sessions;
// A session's placed entries, as the committed summary gives them, and its 24-key beacons.
const placed = (s) => s.placements.flatMap((p) => p.entries);
const beaconsOf = (s) => placed(s).filter((e) => e.includes('/simple.gif q24'));
const joined = (items) => `${items.slice(0, -1).join(', ')} and ${String(items.at(-1))}`;
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'))
    .split('|')
    .map((cell) => flat(cell).trim());

// The suggestions of the review of a9a4619, each with a term that its bullet names.
const SUGGESTIONS = {
  'Suggestion 1': 'lib/placement.mjs',
  'Suggestion 2': 'research/excalidraw/README.md',
  'Suggestion 3': 'reviewState',
};

const text = () => reviewByHead(checkpoint(), 'a9a4619').text;
const entry = () => flat(text());
// The bullet of the entry that handles `finding`, flattened.
const bullet = (finding) =>
  flat(
    text()
      .split(/\n +- /u)
      .find((part) => part.startsWith(`**${finding},`)) ?? '',
  );

describe('the record of the review of a9a4619', () => {
  it('lists it fifteenth, with its counts, verdict, session and range', () => {
    expect(
      listedReviews(checkpoint())
        .map((r) => r.head)
        .indexOf('a9a4619'),
    ).toBe(14);
    expect(entry()).toMatch(
      /^15\. Review of a9a4619: 0 critical, 0 major, 0 minor findings and 3 suggestions\. It meets the R-75 exit rule: it covers a9a4619, where the fourteenth-review remediation ends, and the commits after it only record this review\./u,
    );
    expect(entry()).toContain('the fourteenth-review remediation 620eccf..a9a4619 read-only');
    expect(entry()).toContain(
      'eb7ff974-8d46-4d36-b89d-ee74befdca5e, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
    expect(entry()).toContain('only through allowlisting wrappers');
    expect(entry()).toContain('It found each of the 7 findings of the review of 620eccf fixed');
  });

  it('records what it verified, with the totals it recomputed from the raw records', () => {
    const timeline = sessions().reduce((sum, s) => sum + s.timeline_rows, 0);
    const entries = sessions().reduce((sum, s) => sum + s.netlog_entries, 0);
    const files = readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter(
      (name) => name.endsWith('.json') && !COMMITTED_AFTER_DB16323.includes(name),
    );
    expect(entry()).toContain('npm run validate on a9a4619 (52 test files and 633 tests');
    expect(entry()).toContain('the research projects (44 files and 581 tests)');
    expect(entry()).toContain('npm run test:e2e (1 of 1)');
    expect(entry()).toContain('audit:deps (0 vulnerabilities; 388 packages with verified');
    expect(entry()).toContain(
      `found all ${String(files.length)} identical byte for byte after Prettier`,
    );
    expect(entry()).toContain(
      `${timeline.toLocaleString('en-US')} timeline rows and ${String(entries)} netlog entries`,
    );
    expect(entry()).toMatch(
      /Of its 36 sabotage mutations[^.]*35 failed a check; the one that passed is Suggestion 2/u,
    );
    expect(entry()).toContain(
      'but could not verify the totals of 69 mutations, 12 control copies and 18 record mutations',
    );
    expect(entry()).toContain('PR #2 a Draft with head a9a4619');
    expect(entry()).toContain('all 8 check runs succeeded on a9a4619');
  });
});

describe('the raw-record totals in the record of the review of a9a4619', () => {
  it('match the 24-key beacons and the socket closes of the committed placement', () => {
    const split = sessions()
      .map((s) => [s.session.split('-')[0], beaconsOf(s)])
      .filter(([, beacons]) => beacons.length > 0);
    const total = split.reduce((sum, [, beacons]) => sum + beacons.length, 0);
    expect(entry()).toContain(
      `the ${String(total)} beacons with 24 query keys, ` +
        `${joined(split.map(([name, beacons]) => `${String(beacons.length)} in ${name}`))}, each`,
    );
    expect(
      sessions()
        .flatMap(placed)
        .filter((e) => e.includes(' websocket-close ')),
    ).toEqual([]);
    expect(entry()).toContain(
      `no websocket-close event in any of the ${String(sessions().length)} netlogs`,
    );
  });

  it('records what it did not run or verify', () => {
    expect(entry()).toMatch(
      /It did not run isolation-check\.sh or selftest\.sh[^;]*; ran no live session, driver\.mjs or run\.mjs; called no REA tool/u,
    );
    expect(entry()).toContain('so lines deleted in the range were not scanned');
    expect(entry()).toContain('Its permissions refused 4 of its commands');
  });
});

describe('the suggestions of the review of a9a4619', () => {
  it('are listed as open and not addressed', () => {
    expect(entry()).toContain('Suggestions 1–3 are not addressed in this record.');
    for (const [finding, term] of Object.entries(SUGGESTIONS))
      expect(bullet(finding), finding).toContain(term);
    expect(entry()).not.toMatch(/Minor \d|Suggestion 4/u);
    expect(entry()).toContain(
      'The 4 suggestions of the review of 6d5d264 and suggestions 2–10 of the review of a85eb82 ' +
        'stay open as listed there.',
    );
    expect(entry()).toMatch(/would be behaviour-changing[^.]*fresh review under the rule/u);
  });
});

describe('the review of a9a4619 against the exit rule', () => {
  it('ends the fourteenth-review remediation at a9a4619, the head the review covers', () => {
    expect(flat(section('Checks of the fourteenth-review remediation'))).toContain(
      'The remediation ends at a9a4619, the commit that adds this section.',
    );
    expect(reviewState(checkpoint(), 'a9a4619')).toEqual({
      head: 'a9a4619',
      blocking: 0,
      covers: true,
      remediated: false,
      reviewMeets: true,
    });
  });

  it('met the exit rule at this record and kept its suggestions in the R-75 row', () => {
    // R-75 at the latest head follows the exit rule (documentation-eighth-review.test.mjs); the
    // observation batch after db16323 is not covered by a review, so it is open again.
    expect(reviewState(checkpoint(), 'a9a4619').reviewMeets).toBe(true);
    expect(r75()[6]).toMatch(/620eccf, a9a4619$/u);
    expect(r75()[7]).toContain(
      'its 3 suggestions stay open, with their handling in the checkpoint',
    );
  });

  it('records that PR #2 stays a Draft and issue #1 open', () => {
    // The counts as the record gave them; the live lists are checked with the observation batch.
    expect(entry()).toContain('It found that PR #2 should not leave Draft yet');
    expect(entry()).toContain(
      'issue #1 cannot close: six acceptance criteria and two testing requirements are Partial',
    );
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});

describe('the checks of the fifteenth-review record', () => {
  const checks = () => flat(section('Checks of the fifteenth-review record'));

  it('name what changed, what ran and what did not', () => {
    expect(checks()).toContain(
      'This record changes only the checkpoint, the residual matrix, the record checks and the ' +
        'number words of review-list.mjs.',
    );
    expect(checks()).toContain('ab2a687 adds the words for a fifteenth review');
    expect(checks()).toContain('none of the three suggestions is addressed');
    expect(checks()).toMatch(/npm run validate passed on ab2a687[^.]*52 test files and 633 tests/u);
    expect(checks()).toContain(
      'failed with the ab2a687 documents (11 checks: the 9 new ones and 2 of the 3 rewritten ones)',
    );
    expect(checks()).toMatch(/at least one of 67 mutations[^.]*\(4 control copies, all passed\)/u);
    expect(checks()).toContain('in a temporary copy outside the repository');
    expect(checks()).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(checks()).toMatch(/selftest\.sh were not run again/u);
    expect(checks()).toContain('no live session ran');
  });
});
