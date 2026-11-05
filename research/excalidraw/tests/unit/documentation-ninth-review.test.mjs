// Checks the record of the review of a85eb82, found by its head: its counts and verdict, that it
// covered a85eb82, where the eighth-review remediation ends, and met the R-75 exit rule as the rule
// then stood, that the R-76 commits after it took R-75 back to open, and the handling of each of
// its ten suggestions.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { blockingFindings, reviewByHead } from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'));

describe('the record of the review of a85eb82', () => {
  const entry = () => flat(reviewByHead(checkpoint(), 'a85eb82').text);

  it('lists it ninth, as having met the exit rule on the head where its remediation ended', () => {
    expect(entry()).toMatch(
      /^9\. Review of a85eb82: 0 critical, 0 major, 0 minor findings and 10 suggestions\. It met the R-75 exit rule as the rule then stood: it covered a85eb82, where the eighth-review remediation ends/u,
    );
    expect(blockingFindings(reviewByHead(checkpoint(), 'a85eb82'))).toBe(0);
    expect(flat(section('Checks of the eighth-review remediation'))).toContain(
      'The remediation ends at a85eb82',
    );
    expect(entry()).toMatch(
      /R-75 was ✅ until the R-76 commits after 935f2fc[^.]*behaviour-changing/u,
    );
    expect(r75()).toContain('`a85eb82`');
  });

  it('lists the handling of each of its ten suggestions', () => {
    for (let n = 1; n <= 10; n += 1) expect(entry()).toContain(`Suggestion ${String(n)},`);
    for (const commit of ['407b28c', '306c35c']) expect(entry()).toContain(commit);
    expect(entry()).toMatch(/Suggestions 2–10 are not addressed in this record\./u);
    expect(entry()).toMatch(/would be behaviour-changing[^.]*fresh review under the rule/u);
  });

  it('records the checks of the record', () => {
    const checks = flat(section('Checks of the ninth-review record'));
    expect(checks).toMatch(/npm run validate passed on 306c35c[^.]*31 test files and \d+ tests/u);
    expect(checks).toContain('in a temporary copy outside the repository');
    expect(checks).toMatch(/test:e2e was not run locally/u);
    expect(checks).toMatch(/selftest\.sh were not run again/u);
  });
});
