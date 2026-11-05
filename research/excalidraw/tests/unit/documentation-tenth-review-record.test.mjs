// Checks the record of the review of f1562ed, found by its head: its counts, session, range and
// verdict, the handling of each finding, the exit rule that now covers every behaviour-changing
// commit, and R-75, the review-session requirement and issue #1 left open while the remediation
// of that review is not covered by a review.
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

// The commits of the tenth-review remediation that the record maps to its findings.
const COMMITS = ['8bfdfe3', '38b973e', '42c0664', '19bfa5d', '52523e0', 'f0eac4f', '5eb8852'];

describe('the record of the review of f1562ed', () => {
  const entry = () => flat(reviewByHead(checkpoint(), 'f1562ed').text);

  it('lists it last, with its counts, verdict, session and range', () => {
    expect(listedReviews(checkpoint()).at(-1).head).toBe('f1562ed');
    expect(entry()).toMatch(
      /^10\. Review of f1562ed: 0 critical, 0 major, 4 minor findings and 5 suggestions\. It does not meet the R-75 exit rule, because it reports four minor findings\./u,
    );
    expect(entry()).toContain('935f2fc..f1562ed');
    expect(entry()).toContain(
      'c599db1b-0236-4cb5-b0d9-b74e60fdffaf, Claude Opus 5.5 at xhigh effort',
    );
    expect(entry()).toContain('It is an automated Claude Code review, not human approval.');
  });

  it('maps every finding to its handling and keeps the ninth review suggestions open', () => {
    for (let n = 1; n <= 4; n += 1) expect(entry()).toContain(`Minor ${String(n)},`);
    for (let n = 1; n <= 5; n += 1) expect(entry()).toContain(`Suggestion ${String(n)},`);
    for (const commit of COMMITS) expect(entry()).toContain(commit);
    expect(entry()).toContain('Suggestions 2–10 of the review of a85eb82 stay open');
  });

  it('names the remediation as not covered by a review, with a finite next review', () => {
    const text = reviewByHead(checkpoint(), 'f1562ed').text;
    expect(text).toMatch(/^ +- \*\*Not covered by a review\.\*\*/mu);
    expect(entry()).toMatch(
      /Not covered by a review\. The tenth-review remediation, from 8bfdfe3 to the commit that records its checks, is behaviour-changing\. R-75 stays 🟡 until one fresh independent read-only review of the head where it ends, covering f1562ed to that head, reports 0 critical, 0 major and 0 minor findings\./u,
    );
  });

  it('leaves R-75, the review requirement and issue #1 open', () => {
    expect(exitRuleState(checkpoint())).toMatchObject({
      head: 'f1562ed',
      blocking: 4,
      remediated: true,
      unreviewed: true,
      met: false,
    });
    expect([r75()[5], r75()[9]]).toEqual(['🟡', '1']);
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

describe('the checks of the tenth-review remediation', () => {
  const checks = () => flat(section('Checks of the tenth-review remediation'));
  const committed = () =>
    readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).filter((n) => n.endsWith('.json'));

  it('name its commits, where it ends and the checks that ran or did not', () => {
    for (const commit of [...COMMITS, '5f955a6']) expect(checks()).toContain(commit);
    expect(checks()).toContain('The remediation ends at the commit that adds this section');
    expect(checks()).toMatch(/npm run validate passed on 5f955a6[^.]*39 test files and 528 tests/u);
    expect(checks()).toContain(
      `all ${String(committed().length)} committed evidence files regenerate byte for byte`,
    );
    expect(checks()).toContain('in a temporary copy outside the repository');
    expect(checks()).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(checks()).toMatch(/selftest\.sh were not run again/u);
    expect(checks()).toContain('no live session ran');
  });
});

describe('the exit rule state', () => {
  // A minimal checkpoint: a remediation that ends at the head of a clean second review.
  const record = (extra) =>
    [
      '# Checkpoint',
      '## Checks of the first-review remediation',
      '- The remediation ends at 1111111.',
      '## Independent reviews',
      '1. **Review of `0000000`**: 0 critical, 1 major, 0 minor findings.',
      '2. **Review of `1111111`**: 0 critical, 0 major, 0 minor findings.',
      '## Later work',
      extra,
      '',
    ].join('\n');

  it('is not met while a bullet names commits that no review covers', () => {
    expect(exitRuleState(record('- Later commits.'))).toMatchObject({ covers: true, met: true });
    for (const bullet of [
      '- **Not covered by a review.** Later commits.',
      '   - **Not covered by a review.** A remediation.',
    ]) {
      expect(exitRuleState(record(bullet)), bullet).toMatchObject({
        unreviewed: true,
        met: false,
      });
    }
  });
});
