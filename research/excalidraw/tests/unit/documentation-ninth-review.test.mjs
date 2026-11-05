// Checks the record of the review of a85eb82, found by its head: its counts and verdict, that it
// covers a85eb82, where the eighth-review remediation ends, the handling of each of its ten
// suggestions, and that it closes R-75 only, while the other Partial criteria and issue #1 stay
// open.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { exitRuleState, reviewByHead } from './review-list.mjs';

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
    .find((line) => line.startsWith('| R-75 |'));

describe('the record of the review of a85eb82', () => {
  const entry = () => flat(reviewByHead(checkpoint(), 'a85eb82').text);

  it('lists it ninth, meeting the exit rule on the head where the last remediation ends', () => {
    expect(entry()).toMatch(
      /^9\. Review of a85eb82: 0 critical, 0 major, 0 minor findings and 10 suggestions\. It meets the R-75 exit rule: it covers a85eb82, where the eighth-review remediation ends/u,
    );
    expect(flat(section('Checks of the eighth-review remediation'))).toContain(
      'The remediation ends at a85eb82',
    );
    expect(exitRuleState(checkpoint())).toEqual({
      head: 'a85eb82',
      blocking: 0,
      covers: true,
      remediated: false,
      met: true,
    });
    expect(r75()).toContain('`a85eb82`');
  });

  it('lists the handling of each of its ten suggestions', () => {
    for (let n = 1; n <= 10; n += 1) expect(entry()).toContain(`Suggestion ${String(n)},`);
    for (const commit of ['407b28c', '306c35c']) expect(entry()).toContain(commit);
    expect(entry()).toMatch(/Suggestions 2–10 are not addressed in this record\./u);
    expect(entry()).toMatch(/would be behaviour-changing[^.]*fresh review under the rule/u);
  });

  it('closes R-75 only: the other Partial criteria and issue #1 stay open', () => {
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
    ]);
    expect(withStatus('Testing requirements', 'Done')).toContain(
      'Separate Claude Code review session',
    );
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
    expect(flat(section('Remaining observation work'))).toMatch(
      /Maintainer decisions: Export to Link \(R-56\); the generation features \(R-63\);[^.]*\(R-73\)/u,
    );
  });

  it('records the checks of the record', () => {
    const checks = flat(section('Checks of the ninth-review record'));
    expect(checks).toMatch(/npm run validate passed on 306c35c[^.]*31 test files and \d+ tests/u);
    expect(checks).toContain('in a temporary copy outside the repository');
    expect(checks).toMatch(/test:e2e was not run locally/u);
    expect(checks).toMatch(/selftest\.sh were not run again/u);
  });
});
