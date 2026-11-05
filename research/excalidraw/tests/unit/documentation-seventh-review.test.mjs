// Checks the checkpoint statements that the review of a78a210 found stale or wrong (R-75): where
// the evidence regeneration was checked, how many reviews it counts, and which documentation
// checks passed against the 46b2b01 documents. Where it can, each check derives its expectation
// from the repository (the review list, the test sources) instead of a fixed phrase.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const checkpoint = () => read('docs/reverse-engineering/checkpoint.md');
const note = (criterion) =>
  flat(
    checkpoint()
      .split('\n')
      .find((line) => line.startsWith(`| ${criterion} `))
      .split('|')[3],
  );
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
  const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const listed = () =>
    section('Independent reviews').match(/^\d+\. \*\*Review of `[0-9a-f]{7}`/gmu) ?? [];

  it('match the number of reviews listed in the checkpoint', () => {
    const counts = [
      ...flat(checkpoint()).matchAll(/\b([A-Za-z]+) (?:independent )?reviews\b/gu),
    ].filter(([, word]) => NUMBERS.includes(word.toLowerCase()));
    expect(counts.length).toBeGreaterThan(0);
    for (const [phrase, word] of counts)
      expect(NUMBERS.indexOf(word.toLowerCase()) + 1, phrase).toBe(listed().length);
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
