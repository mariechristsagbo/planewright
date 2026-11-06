// Checks the checkpoint statements that the review of a78a210 found stale or wrong (R-75): where
// the evidence regeneration was checked, how many reviews it counts, and which documentation
// checks passed against the 46b2b01 documents; and the record of that review itself, found by its
// head. Where it can, each check derives its expectation from the repository (the review list,
// the test sources) instead of a fixed phrase, so recording a later review does not break it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  NUMBERS,
  exitRuleState,
  listedReviews,
  reviewByHead,
  reviewWords,
} from './review-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const cell = (criterion, column) =>
  flat(
    checkpoint()
      .split('\n')
      .find((line) => line.startsWith(`| ${criterion} `))
      .split('|')[column],
  ).trim();
const note = (criterion) => cell(criterion, 3);
const section = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];

describe('the regeneration note', () => {
  it('names the heads where the regeneration was checked, not "this remediation"', () => {
    const text = note('Generated JSON and REA bundles validated');
    expect(text).not.toMatch(/in this remediation/u);
    expect(text).toMatch(
      /byte for byte[^.]*\. [^.]*sixth review on 46b2b01[^.]*review of a78a210/u,
    );
  });
});

describe('review counts', () => {
  it('match the number of reviews listed in the checkpoint', () => {
    const { number } = reviewWords(listedReviews(checkpoint()).length);
    const counts = [
      ...flat(checkpoint()).matchAll(/\b([A-Za-z]+) (?:independent )?reviews\b/gu),
    ].filter(([, word]) => NUMBERS.includes(word.toLowerCase()));
    expect(counts.length).toBeGreaterThan(0);
    for (const [phrase, word] of counts) expect(word.toLowerCase(), phrase).toBe(number);
  });

  it('name the reviews whose remediations added raw-only facts', () => {
    expect(note('`limitations.md`')).toContain('found by the fourth, fifth and sixth reviews');
  });
});

describe('the sixth-review sabotage record', () => {
  const SOURCE = 'research/excalidraw/tests/unit/documentation-sixth-review.test.mjs';
  const titles = () =>
    [...read(SOURCE).matchAll(/\bit(?:\.each\([^)]*\))?\(\s*'([^']+)'/gu)].map(([, title]) => {
      const pattern = title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replaceAll('%s', '\\S+');
      return new RegExp(`^${pattern}$`, 'u');
    });
  const bullet = () =>
    flat(
      section('Checks of the sixth-review remediation')
        .split(/\n- /u)
        .find((part) => part.includes('documentation checks failed')),
    );

  it('names the two passing checks by titles that exist in the test source', () => {
    const named = [...bullet().matchAll(/"([^"]+)"/gu)].map(([, name]) => name);
    expect(named).toEqual([
      'end the raw-only list at its own bullet',
      'lists under priority 2 only rows of that priority',
    ]);
    for (const name of named)
      expect(
        titles().some((title) => title.test(name)),
        name,
      ).toBe(true);
    expect(bullet()).not.toContain('UI-created room');
  });
});

const row = (id) =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith(`| ${id} |`))
    .split('|');

describe('the record of the review of a78a210', () => {
  const entry = () => flat(reviewByHead(checkpoint(), 'a78a210').text);

  it('lists it seventh, with its findings, their commits and the suggestions left open', () => {
    expect(entry()).toMatch(
      /^7\. Review of a78a210: 0 critical, 0 major, 3 minor findings and 3 suggestions\./u,
    );
    for (const commit of ['b72d28d', '4f25d13', 'db24b1f']) expect(entry()).toContain(commit);
    expect(entry()).toMatch(/Suggestions 2 and 3[^.]*not addressed/u);
    expect(row('R-75')[6]).toContain('`a78a210`');
  });

  it('records the checks of its remediation', () => {
    const checks = flat(section('Checks of the seventh-review remediation'));
    expect(checks).toMatch(/npm run validate passed on db24b1f[^.]*30 test files and 461 tests/u);
    expect(checks).toContain('in a temporary copy outside the repository');
    expect(checks).toMatch(/test:e2e was not run locally/u);
  });
});

describe('the latest listed review', () => {
  it('sets R-75, the review note and the blocker from the exit rule, and keeps issue #1 open', () => {
    const { number, ordinal } = reviewWords(listedReviews(checkpoint()).length);
    const { head, met, reviewMeets } = exitRuleState(checkpoint());
    const opening = `${number[0].toUpperCase()}${number.slice(1)} independent reviews ran`;
    // The latest review's own verdict; with it met, only commits that no review covers keep R-75
    // open, and the note and the blocker say so.
    const state = reviewMeets
      ? 'meets the R-75 exit rule'
      : 'is remediated[^.]*; no review of that remediation has run yet';
    expect(row('R-75')[5].trim()).toBe(met ? '✅' : '🟡');
    expect(cell('Separate Claude Code review session', 2)).toBe(met ? 'Done' : 'Partial');
    expect(note('Separate Claude Code review session')).toMatch(
      new RegExp(`^${opening}\\. The ${ordinal} \\(of ${head}\\) ${state}`, 'u'),
    );
    if (reviewMeets && !met)
      expect(note('Separate Claude Code review session')).toContain('no review covers it yet');
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
    expect(flat(section('Blockers and residuals'))).toContain(
      reviewMeets
        ? `The ${ordinal} review (of ${head}) meets the exit rule${met ? '' : ', but'}`
        : `${ordinal}-review remediation is still to be run (R-75)`,
    );
  });
});
