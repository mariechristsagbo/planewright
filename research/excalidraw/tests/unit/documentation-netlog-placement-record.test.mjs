// Checks the record of the netlog placement (R-64, R-66) in the checkpoint: its commits, checks
// and limits, the commit message errors it discloses, and that the review of 620eccf covers its
// behaviour-changing commits while the thirteenth review keeps its own verdict. R-75 after the
// fourteenth-review remediation is checked in documentation-fourteenth-review-record.test.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { reviewState } from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
const record = () => section('Netlog placement (R-64, R-66)');
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

  it('discloses the errors in the bodies of 545b97b, 3a1d1a3, e44ba19 and 0b2ebda', () => {
    expect(flat(record())).toContain(
      'The body of 545b97b says that the summary places 523 entries against 1,825 timeline ' +
        'rows; it is 1,815.',
    );
    expect(flat(record())).toContain(
      'The body of 3a1d1a3 names R-66 among the documents that said a request started; R-66 ' +
        'said only when requests came, and that commit added the finish-time limit to it.',
    );
    expect(flat(record())).toContain(
      'The body of e44ba19 says that its new checks derive every count, gap and time from the ' +
        'summary; the beacon split, the four desktop inputs and the socket closes were not ' +
        'derived until 329bc50.',
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

describe('the review that covers the netlog placement', () => {
  it('is the review of 620eccf, at the commit where the work ends', () => {
    expect(record()).not.toMatch(/^- \*\*Not covered by a review\.\*\*/mu);
    expect(flat(record())).toContain(
      'The work ends at 620eccf, the commit after 0b2ebda that corrects two counts here.',
    );
    expect(flat(record())).toContain(
      'Covered by the review of 620eccf. The commits after c010f7e, from 6051fd5 to 620eccf, are ' +
        'behaviour-changing.',
    );
    expect(reviewState(checkpoint(), '620eccf')).toMatchObject({ covers: true, blocking: 1 });
    expect(reviewState(checkpoint(), '6d5d264').reviewMeets).toBe(true);
  });

  it('leaves R-75 open and no longer calls the placement unreviewed', () => {
    expect([r75()[5], r75()[9]]).toEqual(['🟡', '1']);
    expect(r75()[7]).not.toContain('the netlog placement from 6051fd5, are not covered');
    expect(flat(section('Blockers and residuals'))).toContain('Independent review (R-75), open.');
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});
