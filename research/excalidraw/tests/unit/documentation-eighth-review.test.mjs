// Checks what the review of 8029c1e asked of the record: a finite exit rule for R-75, which the
// residual matrix and the checkpoint state the same way, and R-75 kept open while the latest
// listed review reports a critical, major or minor finding.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listedReviews } from './review-list.mjs';

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
// The counts a listed review reports, from its "N critical, N major, N minor" opening.
const blockingFindings = (review) => {
  const counts = /^\d+\. Review of [0-9a-f]{7}: (\d+) critical, (\d+) major, (\d+) minor/u.exec(
    flat(review.text),
  );
  if (!counts) throw new Error(`The review of ${review.head} does not state its counts.`);
  return counts.slice(1).reduce((sum, count) => sum + Number(count), 0);
};

describe('the R-75 exit rule', () => {
  it('is stated in the checkpoint, and R-75, the review note and the blocker point to it', () => {
    const rule = flat(section('Independent reviews').split(/\n\d+\. /u)[0]);
    expect(rule).toMatch(
      /R-75 exit rule\. R-75 may become ✅ only after a fresh independent review of the latest behaviour-changing remediation reports 0 critical, 0 major and 0 minor findings\./u,
    );
    expect(rule).toMatch(/Suggestions that do not block may stay open if they are listed/u);
    expect(rule).toMatch(/Commits that only record a review, its checks or the PR description/u);
    expect(rule).toMatch(/issue #1 also needs/u);
    expect(r75()[8]).toBe(
      'A fresh independent review of the latest behaviour-changing remediation that reports 0 critical, 0 major and 0 minor findings (exit rule in the checkpoint)',
    );
    expect(flat(section('Testing requirements'))).toMatch(/R-75 closes only under the exit rule/u);
    expect(flat(section('Blockers and residuals'))).toMatch(/closes only under the exit rule/u);
  });

  it('keeps R-75 open while the latest listed review reports a blocking finding', () => {
    const latest = listedReviews(checkpoint()).at(-1);
    const blocking = blockingFindings(latest);
    expect(['🟡', '✅']).toContain(r75()[5]);
    expect(r75()[5] !== '✅' || blocking === 0, `review of ${latest.head}`).toBe(true);
  });
});
