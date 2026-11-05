// Checks the record of the review of 4e9c663, found by its head: its counts, session, range,
// wrapper-limited verification and verdict, the handling of each finding, where the
// eleventh-review remediation ends, and R-75, the review-session requirement and issue #1 left
// open while the remediation of that review is not covered by a review.
import { readFileSync, readdirSync } from 'node:fs';
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

// The commits of the twelfth-review remediation, by the finding each one handles.
const COMMITS = {
  'Minor 1': '2b5ff0e',
  'Minor 2': '495e95e',
  'Suggestion 1': 'ffd18a8',
  'Suggestion 2': '32c4647',
  'Suggestion 3': '27e702b',
  'Suggestion 4': '1d21d38',
};

describe('the record of the review of 4e9c663', () => {
  const text = () => reviewByHead(checkpoint(), '4e9c663').text;
  const entry = () => flat(text());
  // The bullet of the entry that handles `finding`, flattened.
  const bullet = (finding) =>
    flat(
      text()
        .split(/\n +- /u)
        .find((part) => part.startsWith(`**${finding},`)) ?? '',
    );

  it('lists it twelfth, with its counts, verdict, session, range and limits', () => {
    expect(
      listedReviews(checkpoint())
        .map((r) => r.head)
        .indexOf('4e9c663'),
    ).toBe(11);
    expect(entry()).toMatch(
      /^12\. Review of 4e9c663: 0 critical, 0 major, 2 minor findings and 4 suggestions\. It does not meet the R-75 exit rule, because it reports two minor findings\./u,
    );
    expect(entry()).toContain('the eleventh-review remediation 79fc538..4e9c663 read-only');
    expect(entry()).toContain(
      'fe7943b0-b556-4c72-83ea-957c83cda547, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
    expect(entry()).toContain('only through allowlisting wrappers');
    expect(entry()).toContain('npm run validate on 4e9c663 (42 test files and 548 tests)');
    expect(entry()).toMatch(
      /comparing 7 byte for byte and the 10 [^.]* by a canonical jq -c digest, because writing them to a file was refused/u,
    );
    expect(entry()).toContain(
      'It did not run audit:deps, isolation-check.sh or selftest.sh, ran no live session and ' +
        'called no REA tool.',
    );
  });

  it('maps every finding to its commit and keeps the ninth review suggestions open', () => {
    for (const [finding, commit] of Object.entries(COMMITS))
      expect(bullet(finding), finding).toContain(`(${commit})`);
    expect(bullet('Suggestion 4')).toContain('No check was added');
    expect(entry()).toContain('Suggestions 2–10 of the review of a85eb82 stay open');
  });

  it('names its remediation as not covered by a review, with a finite next review', () => {
    expect(text()).toMatch(/^ +- \*\*Not covered by a review\.\*\*/mu);
    expect(entry()).toMatch(
      /Not covered by a review\. The twelfth-review remediation, from 2b5ff0e to the commit that records its checks, is behaviour-changing\. R-75 stays 🟡 until one fresh independent read-only review of the head where it ends, covering 4e9c663 to that head, reports 0 critical, 0 major and 0 minor findings\./u,
    );
  });
});

describe('R-75 after the review of 4e9c663', () => {
  it('ends the eleventh-review remediation at 4e9c663, the head it reviewed', () => {
    expect(flat(section('Checks of the eleventh-review remediation'))).toContain(
      'The remediation ends at 4e9c663, the commit that adds this section',
    );
    expect(exitRuleState(checkpoint())).toMatchObject({
      head: '4e9c663',
      blocking: 2,
      covers: true,
      unreviewed: true,
      met: false,
    });
  });

  it('leaves R-75, the review requirement and issue #1 open', () => {
    expect([r75()[5], r75()[9]]).toEqual(['🟡', '1']);
    expect(r75()[6]).toContain('4e9c663');
    expect(withStatus('Acceptance criteria', 'Partial')).toEqual([
      'feature-inventory.md covers all discovered features',
      'behavior-analysis.md',
      'limitations.md',
      'Desktop light/dark and mobile evidence sets',
      'Canvas interactions through the external driver while REA observes',
      'Prioritised backlog with acceptance criteria',
    ]);
    expect(withStatus('Testing requirements', 'Partial')).toEqual([
      'Re-run each documented interaction from a fresh profile',
      'Generated JSON and REA bundles validated',
      'Separate Claude Code review session',
    ]);
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
    expect(flat(section('Blockers and residuals'))).toContain('Independent review (R-75), open.');
  });
});

describe('the checks of the twelfth-review remediation', () => {
  const text = () => section('Checks of the twelfth-review remediation');
  const committed = () =>
    readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter((n) => n.endsWith('.json'));

  it('name its commits, where it ends and the checks that ran or did not', () => {
    const checks = flat(text());
    for (const commit of [...Object.values(COMMITS), 'e59ecf8']) expect(checks).toContain(commit);
    expect(checks).toContain('The remediation ends at the commit that adds this section');
    expect(checks).toMatch(/npm run validate passed on e59ecf8[^.]*44 test files and 560 tests/u);
    expect(checks).toContain(
      `all ${String(committed().length)} committed evidence files regenerate byte for byte`,
    );
    expect(checks).toContain('in a temporary copy outside the repository');
    expect(checks).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(checks).toMatch(/selftest\.sh were not run again/u);
    expect(checks).toContain('no live session ran');
  });

  it('name the remediation as not covered by a review', () => {
    expect(text()).toMatch(/^- \*\*Not covered by a review\.\*\*/mu);
    expect(exitRuleState(checkpoint())).toMatchObject({ remediated: true, met: false });
  });
});
