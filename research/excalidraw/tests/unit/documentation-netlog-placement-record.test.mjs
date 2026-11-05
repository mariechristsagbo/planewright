// Checks the record of the netlog placement (R-64, R-66) in the checkpoint: its commits, checks
// and limits, the commit message error it discloses, and that its behaviour-changing commits,
// which no review covers yet, keep R-75 and the review-session requirement open while the
// thirteenth review keeps its own verdict.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { exitRuleState } from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
const record = () => section('Netlog placement (R-64, R-66)');
// The cells of a checkpoint status table row, by its name.
const status = (title, name) =>
  section(title)
    .split('\n')
    .find((line) => line.startsWith(`| ${name} `))
    .split('|')
    .map((cell) => flat(cell).trim());
const r75 = () =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith('| R-75 |'))
    .split('|')
    .map((cell) => flat(cell).trim());

// The commits of the netlog placement up to the one that records it, in order.
const COMMITS = ['6051fd5', '545b97b', '3a1d1a3', 'e44ba19', 'a078f83', 'eff8534', '0b2ebda'];

describe('the record of the netlog placement', () => {
  it('names its commits and says that it used retained evidence only', () => {
    const text = flat(record());
    // The Commits bullet names every commit, in order.
    const commits = text.split(' - Commits. ')[1].split(' - What the times show.')[0];
    let at = -1;
    for (const commit of COMMITS) {
      expect(commits.indexOf(commit), commit).toBeGreaterThan(at);
      at = commits.indexOf(commit);
    }
    expect(text).toContain('no live session ran, no site was contacted');
    expect(text).toContain('It is not a review remediation');
    expect(text).toContain('none of the four suggestions of the review of 6d5d264 is addressed');
  });

  it('records the checks that ran, and those that did not', () => {
    const text = flat(record());
    expect(text).toMatch(/npm run validate passed on eff8534[^.]*50 test files and 605 tests/u);
    expect(text).toContain('lib/placement.mjs at 100%');
    expect(text).toContain('in a temporary copy outside the repository');
    expect(text).toContain('all 18 committed evidence files regenerate byte for byte');
    expect(text).toMatch(
      /test:e2e was not run locally: nothing under apps\/ or packages\/ changed/u,
    );
    expect(text).toMatch(/selftest\.sh were not run again/u);
  });

  it('discloses the errors in the bodies of 545b97b, 3a1d1a3 and 0b2ebda', () => {
    expect(flat(record())).toContain(
      'The body of 545b97b says that the summary places 523 entries against 1,825 timeline ' +
        'rows; it is 1,815.',
    );
    expect(flat(record())).toContain(
      'The body of 3a1d1a3 names R-66 among the documents that said a request started; R-66 ' +
        'said only when requests came, and that commit added the finish-time limit to it.',
    );
    expect(flat(record())).toContain(
      'The body of 0b2ebda says that the new record checks failed 6 tests; 5 were new and 1 was ' +
        'the rewritten entry check of the thirteenth review.',
    );
    expect(flat(record())).toContain(
      'the record checks of this section (5) and the rewritten entry check of the thirteenth ' +
        'review (1)',
    );
  });
});

describe('R-75 after the netlog placement', () => {
  it('names the placement commits as not covered by a review', () => {
    expect(record()).toMatch(/^- \*\*Not covered by a review\.\*\*/mu);
    expect(flat(record())).toContain(
      'Not covered by a review. The commits after c010f7e, from 6051fd5 to 0b2ebda, which adds ' +
        'this section, and the commit after it that corrects two counts here, are ' +
        'behaviour-changing',
    );
    expect(exitRuleState(checkpoint())).toMatchObject({
      head: '6d5d264',
      reviewMeets: true,
      unreviewed: true,
      met: false,
    });
  });

  it('sets R-75 and the review requirement open, with the reason, and keeps issue #1 open', () => {
    expect([r75()[5], r75()[9]]).toEqual(['🟡', '1']);
    expect(r75()[7]).toContain(
      'but the behaviour-changing commits after it, the netlog placement from 6051fd5, are not ' +
        'covered by a review yet',
    );
    expect(status('Testing requirements', 'Separate Claude Code review session')[2]).toBe(
      'Partial',
    );
    expect(flat(section('Blockers and residuals'))).toContain('Independent review (R-75), open.');
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});
