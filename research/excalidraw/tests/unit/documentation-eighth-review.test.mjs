// Checks what the review of 8029c1e asked of the record: a finite exit rule for R-75, which the
// residual matrix and the checkpoint state the same way, R-75 set from the latest listed review
// (open while it reports a critical, major or minor finding or leaves a later head unreviewed,
// done once it meets the rule), and the record of that review, found by its head.
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
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'))
    .split('|')
    .map((cell) => flat(cell).trim());

describe('the R-75 exit rule', () => {
  it('is stated in the checkpoint, and R-75, the review note and the blocker point to it', () => {
    const rule = flat(section('Independent reviews').split(/\n\d+\. /u)[0]);
    expect(rule).toMatch(
      /R-75 exit rule\. R-75 may become ✅ only after a fresh independent review of the latest behaviour-changing commit reports 0 critical, 0 major and 0 minor findings\./u,
    );
    expect(rule).toMatch(/Suggestions that do not block may stay open if they are listed/u);
    expect(rule).toMatch(
      /A commit is behaviour-changing when it changes the research tooling, its tests or a documented research claim, whether or not it remediates a review/u,
    );
    expect(rule).toMatch(/Not covered by a review\. bullet[^.]*R-75 stays 🟡/u);
    expect(rule).toMatch(/Commits that only record a review, its checks or the PR description/u);
    expect(rule).toMatch(/Updating the record checks [^.]* also counts as recording\./u);
    expect(rule).toMatch(/issue #1 also needs/u);
    expect(r75()[8]).toMatch(/exit rule in the checkpoint\)?$/u);
    expect(flat(section('Testing requirements'))).toMatch(/R-75 closes only under the exit rule/u);
    expect(flat(section('Blockers and residuals'))).toMatch(/closes only under the exit rule/u);
  });

  it('sets R-75 from the latest listed review: done only once that review meets it', () => {
    const state = exitRuleState(checkpoint());
    const verdict = state.met ? 'meets' : 'does not meet';
    expect(r75()[5], JSON.stringify(state)).toBe(state.met ? '✅' : '🟡');
    expect(r75()[7]).toMatch(
      new RegExp(`review of ${state.head} reported [^.]*, so it ${verdict} the exit rule`, 'u'),
    );
    expect(r75()[8]).toMatch(
      state.met
        ? new RegExp(`^None while no behaviour-changing commit follows ${state.head};`, 'u')
        : /^A fresh independent review of the latest behaviour-changing commit that reports 0 critical, 0 major and 0 minor findings/u,
    );
    expect(r75()[9]).toBe(state.met ? '—' : '1');
  });

  it('is applied to the latest listed review, which states whether it meets it', () => {
    const latest = listedReviews(checkpoint()).at(-1);
    const verdict = exitRuleState(checkpoint()).met ? 'meets' : 'does not meet';
    expect(flat(latest.text)).toContain(`It ${verdict} the R-75 exit rule`);
  });
});

describe('the record of the review of 8029c1e', () => {
  const entry = () => flat(reviewByHead(checkpoint(), '8029c1e').text);

  it('lists its findings, their handling and why it does not meet the exit rule', () => {
    expect(entry()).toMatch(
      /^8\. Review of 8029c1e: 0 critical, 0 major, 1 minor finding and 4 suggestions\. It does not meet the R-75 exit rule, because it reports one minor finding\./u,
    );
    for (const commit of ['ff04c79', '0e847d2', '8620915', '080e238'])
      expect(entry()).toContain(commit);
    expect(entry()).toMatch(/Suggestion 2[^.]*outside the tree/u);
    expect(r75()[6]).toContain('8029c1e');
  });

  it('records the checks of its remediation', () => {
    const checks = flat(section('Checks of the eighth-review remediation'));
    expect(checks).toMatch(/npm run validate passed on 080e238[^.]*31 test files and 468 tests/u);
    expect(checks).toContain('in a temporary copy outside the repository');
    expect(checks).toMatch(/test:e2e was not run locally/u);
    expect(checks).toMatch(/selftest\.sh were not run again/u);
  });
});
