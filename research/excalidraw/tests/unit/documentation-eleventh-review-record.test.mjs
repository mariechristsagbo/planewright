// Checks the record of the review of 79fc538, found by its head: its counts, session, range,
// permission-limited verification and verdict, the handling of each finding, where the
// tenth-review remediation ends, and R-75, the review-session requirement and issue #1 left open
// while the remediation of that review is not covered by a review.
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

// The commits of the eleventh-review remediation, by the finding each one handles.
const COMMITS = {
  'Minor 1': 'd61898e',
  'Suggestion 1': 'bdaa4a4',
  'Suggestion 2': '5574b04',
  'Suggestion 3': 'a64611a',
  'Suggestion 4': 'c30387d',
  'Suggestion 5': '28db3b4',
  'Suggestion 6': '328c7fb',
};

describe('the record of the review of 79fc538', () => {
  const entry = () => flat(reviewByHead(checkpoint(), '79fc538').text);

  it('lists it eleventh, with its counts, verdict, session, range and limits', () => {
    expect(
      listedReviews(checkpoint())
        .map((r) => r.head)
        .indexOf('79fc538'),
    ).toBe(10);
    expect(entry()).toMatch(
      /^11\. Review of 79fc538: 0 critical, 0 major, 1 minor finding and 6 suggestions\. It does not meet the R-75 exit rule, because it reports one minor finding\./u,
    );
    expect(entry()).toContain('the tenth-review remediation f1562ed..79fc538 read-only');
    expect(entry()).toContain(
      '804f5e47-57d1-4f43-9fd6-659a650da081, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
    expect(entry()).toMatch(
      /Its verification was limited by its permissions: [^.]*node, npm and npx[^.]*gh[^.]*raw evidence/u,
    );
    expect(entry()).toMatch(/It therefore ran no validation[^.]*regeneration, sabotage/u);
  });

  it('maps every finding to its commit and keeps the ninth review suggestions open', () => {
    for (const [finding, commit] of Object.entries(COMMITS))
      expect(entry()).toMatch(new RegExp(`${finding}, [^:]*:[^.]*${commit}`, 'u'));
    expect(entry()).toContain('Suggestions 2–10 of the review of a85eb82 stay open');
    expect(entry()).toMatch(/footer-leading-blank[^.]*on bdaa4a4/u);
  });

  it('names its remediation as not covered by a review, with a finite next review', () => {
    const text = reviewByHead(checkpoint(), '79fc538').text;
    expect(text).toMatch(/^ +- \*\*Not covered by a review\.\*\*/mu);
    expect(entry()).toMatch(
      /Not covered by a review\. The eleventh-review remediation, from d61898e to the commit that records its checks, is behaviour-changing\. R-75 stays 🟡 until one fresh independent read-only review of the head where it ends, covering 79fc538 to that head, reports 0 critical, 0 major and 0 minor findings\./u,
    );
  });
});

describe('R-75 after the review of 79fc538', () => {
  it('ends the tenth-review remediation at 79fc538, the head it reviewed', () => {
    expect(flat(section('Checks of the tenth-review remediation'))).toContain(
      'The remediation ends at 79fc538, the commit that adds this section',
    );
    expect(exitRuleState(checkpoint())).toMatchObject({
      head: '79fc538',
      blocking: 1,
      covers: true,
      unreviewed: true,
      met: false,
    });
  });

  it('leaves R-75, the review requirement and issue #1 open', () => {
    expect([r75()[5], r75()[9]]).toEqual(['🟡', '1']);
    expect(r75()[6]).toContain('79fc538');
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
