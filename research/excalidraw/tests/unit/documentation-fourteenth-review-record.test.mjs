// Checks the record of the review of 620eccf, found by its head: its counts, session, range,
// verification, limits and verdict, the commit of each of its findings, that it covers the netlog
// placement and does not meet the exit rule on its own, the checks of its remediation, and that
// the review of a9a4619 covers that remediation. R-75 after it is checked in
// documentation-fifteenth-review-record.test.mjs.
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
const evidence = (name) => JSON.parse(read(`docs/reverse-engineering/evidence/${name}`));
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'))
    .split('|')
    .map((cell) => flat(cell).trim());

// The findings of the review of 620eccf, each with the commits that handle it.
const FINDINGS = {
  'Minor 1': ['134b173'],
  'Suggestion 1': ['5c6a886'],
  'Suggestion 2': ['329bc50'],
  'Suggestion 3': ['bdc8140'],
  'Suggestion 4': ['7bceb59', '46f447a'],
  'Suggestion 5': ['2f0cd20'],
  'Suggestion 6': ['0b77988', 'f6a9ffe'],
};
// The commits of the remediation before the one that records the review, in order.
const COMMITS = ['93e4ae2', '50b2632', ...new Set(Object.values(FINDINGS).flat())];

const text = () => reviewByHead(checkpoint(), '620eccf').text;
const entry = () => flat(text());
// The bullet of the entry that handles `finding`, flattened.
const bullet = (finding) =>
  flat(
    text()
      .split(/\n +- /u)
      .find((part) => part.startsWith(`**${finding},`)) ?? '',
  );

describe('the record of the review of 620eccf', () => {
  it('lists it fourteenth, with its counts, verdict, session and range', () => {
    expect(
      listedReviews(checkpoint())
        .map((r) => r.head)
        .indexOf('620eccf'),
    ).toBe(13);
    expect(entry()).toMatch(
      /^14\. Review of 620eccf: 0 critical, 0 major, 1 minor finding and 6 suggestions\. It does not meet the R-75 exit rule, because it reports one minor finding\./u,
    );
    expect(entry()).toContain('It reviewed the netlog placement c010f7e..620eccf read-only');
    expect(entry()).toContain(
      '2f956c5d-bae6-4453-8b08-92733f1f3472, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
    expect(entry()).toContain('only through allowlisting wrappers');
  });

  it('records what it verified, with the totals it recomputed from the raw records', () => {
    const sessions = evidence('netlog-steps.json').sessions;
    const rows = sessions.reduce((sum, s) => sum + s.timeline_rows, 0);
    const entries = sessions.reduce((sum, s) => sum + s.netlog_entries, 0);
    const files = readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter(
      (name) => name.endsWith('.json') && !COMMITTED_AFTER_DB16323.includes(name),
    );
    expect(entry()).toContain('npm run validate on 620eccf (51 test files and 610 tests');
    expect(entry()).toContain('the research projects (43 files and 558 tests)');
    expect(entry()).toMatch(/npm run test:e2e \(1 of 1; a first attempt[^)]*package\.json\)/u);
    expect(entry()).toContain(
      `found all ${String(files.length)} identical byte for byte after Prettier`,
    );
    expect(entry()).toContain(
      `${rows.toLocaleString('en-US')} timeline rows and ${String(entries)} netlog entries, ` +
        'which confirms the error in the body of 545b97b',
    );
    expect(entry()).toMatch(
      /42 failed a check, 9 passed \(its Suggestions 1–4\) and 1 was invalid/u,
    );
    expect(entry()).toContain('PR #2 a Draft with all 8 check runs succeeded on 620eccf');
  });

  it('records what it did not run or verify', () => {
    expect(entry()).toMatch(
      /It did not run isolation-check\.sh or selftest\.sh[^;]*; ran no live session, driver\.mjs or run\.mjs; called no REA tool/u,
    );
    expect(entry()).toContain('refused 11 of its commands, git ls-remote among them');
    expect(entry()).toContain(
      'It could not verify the mutation tallies that the commit bodies give',
    );
  });
});

describe('the handling of the findings of the review of 620eccf', () => {
  it('maps its minor finding and six suggestions to the commits that handle them', () => {
    for (const [finding, commits] of Object.entries(FINDINGS))
      for (const commit of commits) expect(bullet(finding), finding).toContain(commit);
    expect(entry()).not.toMatch(/Minor 2|Suggestion 7/u);
    expect(entry()).toContain('Recording. 93e4ae2 adds the words for a fourteenth review');
    expect(entry()).toContain(
      'The 4 suggestions of the review of 6d5d264 and suggestions 2–10 of the review of a85eb82 ' +
        'stay open as listed there',
    );
  });
});

describe('the review of 620eccf against the exit rule', () => {
  it('covers the netlog placement, which ends at its head, and does not meet the rule', () => {
    expect(reviewState(checkpoint(), '620eccf')).toEqual({
      head: '620eccf',
      blocking: 1,
      covers: true,
      remediated: true,
      reviewMeets: false,
    });
    const work = section('Netlog placement (R-64, R-66)');
    expect(flat(work)).toContain('The work ends at 620eccf');
    expect(work).not.toMatch(/^- \*\*Not covered by a review\.\*\*/mu);
    expect(flat(reviewByHead(checkpoint(), '6d5d264').text)).toContain(
      'Covered by the review of 620eccf. The netlog placement, c010f7e..620eccf',
    );
  });

  it('names its remediation as covered by the review of a9a4619, and keeps issue #1 open', () => {
    expect(r75()[6]).toContain('6d5d264, 620eccf');
    expect(entry()).toContain(
      'Covered by the review of a9a4619. The fourteenth-review remediation, 620eccf..a9a4619, ' +
        'from 93e4ae2 to a9a4619, is behaviour-changing.',
    );
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});

describe('the checks of the fourteenth-review remediation', () => {
  const checks = () => flat(section('Checks of the fourteenth-review remediation'));

  it('name its commits, in order, and where it ends', () => {
    const commits = checks().split('Commits. ')[1].split(' - ')[0];
    let at = -1;
    for (const commit of COMMITS) {
      expect(commits.indexOf(commit), commit).toBeGreaterThan(at);
      at = commits.indexOf(commit);
    }
    expect(commits).toContain(
      'The remediation ends at a9a4619, the commit that adds this section.',
    );
    expect(section('Checks of the fourteenth-review remediation')).not.toMatch(
      /^- \*\*Not covered by a review\.\*\*/mu,
    );
    expect(checks()).toContain(
      'Review. The review of a9a4619, the fifteenth, covers this remediation (620eccf..a9a4619). ' +
        'It reported no critical, major or minor finding, so the exit rule is met',
    );
  });

  it('record the checks that ran, and those that did not', () => {
    const files = readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter(
      (name) => name.endsWith('.json') && !COMMITTED_AFTER_DB16323.includes(name),
    );
    expect(checks()).toMatch(/npm run validate passed on f6a9ffe[^.]*51 test files and 625 tests/u);
    expect(checks()).toContain('lib/placement.mjs at 100%');
    expect(checks()).toContain(
      `all ${String(files.length)} committed evidence files regenerate byte for byte`,
    );
    expect(checks()).toMatch(/at least one of 69 mutations[^.]*12 control copies, all passed/u);
    expect(checks()).toContain('68 of the mutations failed a check');
    expect(checks()).toContain('The one that passed allows two millisecond digits');
    expect(checks()).toContain(
      'The record checks of this record failed 11 with the f6a9ffe documents, 8 new and 3 rewritten.',
    );
    expect(checks()).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(checks()).toMatch(/selftest\.sh were not run again/u);
    expect(checks()).toContain('no live session ran');
  });
});
