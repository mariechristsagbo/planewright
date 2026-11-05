// Checks the record of the review of 79fc538, found by its head: its counts, session, range,
// permission-limited verification and verdict, the handling of each finding, where the
// tenth-review remediation ends, and that the review of 4e9c663 covers the remediation of that
// review.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { blockingFindings, listedReviews, reviewByHead } from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
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

  it('records that the review of 4e9c663 covers the remediation, which keeps R-75 open', () => {
    const text = reviewByHead(checkpoint(), '79fc538').text;
    expect(text).not.toMatch(/^ +- \*\*Not covered by a review\.\*\*/mu);
    expect(text).toMatch(/^ +- \*\*Covered by the review of `4e9c663`\.\*\*/mu);
    expect(entry()).toMatch(
      /Covered by the review of 4e9c663\. The eleventh-review remediation, 79fc538\.\.4e9c663, from d61898e to 4e9c663, is behaviour-changing\. The review of 4e9c663 covers it and reports two minor findings, so it does not meet the exit rule/u,
    );
    expect(blockingFindings(reviewByHead(checkpoint(), '79fc538'))).toBe(1);
    expect(r75()[6]).toContain('79fc538');
  });
});

describe('where the tenth-review remediation ends', () => {
  it('ends it at 79fc538, the head that the review of 79fc538 covered', () => {
    expect(flat(section('Checks of the tenth-review remediation'))).toContain(
      'The remediation ends at 79fc538, the commit that adds this section',
    );
  });
});

describe('the checks of the eleventh-review remediation', () => {
  const text = () => section('Checks of the eleventh-review remediation');
  const committed = () =>
    readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter((n) => n.endsWith('.json'));

  it('name its commits, where it ends and the checks that ran or did not', () => {
    const checks = flat(text());
    for (const commit of [...Object.values(COMMITS), '776dc05']) expect(checks).toContain(commit);
    expect(checks).toContain('The remediation ends at 4e9c663, the commit that adds this section');
    expect(checks).toMatch(/npm run validate passed on 776dc05[^.]*42 test files and 546 tests/u);
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

  it('say that the review of 4e9c663 covers the remediation', () => {
    expect(text()).not.toMatch(/^- \*\*Not covered by a review\.\*\*/mu);
    expect(flat(text())).toContain(
      'Review. The review of 4e9c663, the twelfth, covers this remediation (79fc538..4e9c663). ' +
        'It reported two minor findings, so the exit rule is not met',
    );
  });
});
