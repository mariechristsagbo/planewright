// Checks the claims that the review of f1562ed found stale, overstated or unguarded, against the
// committed evidence: each expectation is derived from the evidence index, so a claim fails if
// its wording regresses or if the evidence it rests on changes.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  RE,
  ROOT,
  cells,
  digests,
  doc,
  entry,
  evidence,
  field,
  flat,
  probe,
  strip,
} from './r76-evidence.mjs';

// "a, b and c", as the documents join a list.
const joined = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

describe('the page-load count', () => {
  const loads = () =>
    evidence('sessions.json').sessions.reduce(
      (sum, s) => sum + (s.steps.byKind.goto ?? 0) + (s.steps.byKind.reload ?? 0),
      0,
    );

  // Every "page-load count (N)" a research document states, as [document, phrase, N].
  const statedIn = (name) =>
    [...doc(name).matchAll(/page-load count \((\d+)\)/gu)].map(([said, n]) => [name, said, n]);

  it('is the committed count wherever a document states it', () => {
    const names = readdirSync(join(ROOT, RE)).filter((name) => name.endsWith('.md'));
    const stated = names.flatMap(statedIn);
    expect(stated.length).toBeGreaterThan(0);
    for (const [name, said, n] of stated) expect(Number(n), `${name}: ${said}`).toBe(loads());
  });
});

// The dark dialogs that scenario 14 captures on mobile, by screenshot name.
const DIALOGS = [
  ['m11-dark-help', 'Help'],
  ['m12-dark-export', 'Export image'],
  ['m13-dark-command-palette', 'Command palette'],
  ['m14-dark-share-dialog', 'Live collaboration'],
  ['m15-dark-reset-confirm', 'Clear canvas'],
];

describe('R-25, the mobile dark dialogs', () => {
  const [s7, s11] = [digests('s7-mobile-fresh'), digests('s11-mobile-r76-14')];
  const same = (shot) => s7.get(`${shot}.png`) === s11.get(`${shot}.png`);

  it('counts only the dialog captures that are byte-identical in s7 and s11', () => {
    const identical = DIALOGS.filter(([shot]) => same(shot)).map(([, name]) => name);
    const differ = DIALOGS.filter(([shot]) => !same(shot)).map(([, name]) => name);
    const all = [...s11].filter(([name, digest]) => s7.get(name) === digest).map(([name]) => name);
    const light = all.filter((name) => !name.includes('-dark-'));
    expect(light.length).toBeGreaterThan(0);
    const cell = flat(cells('R-25')[6]);
    expect(cell).toContain(
      `${String(identical.length)} of the ${String(DIALOGS.length)} dark dialog captures are ` +
        `byte-identical (${identical.join(', ')}); ${joined(differ)} differ (the light ` +
        `${joined(light.map((name) => name.split('-')[0]))} captures are byte-identical too)`,
    );
    expect(cell).not.toMatch(new RegExp(`\\b${String(all.length)} byte-identical`, 'u'));
  });
});

describe("B-06's dark text box", () => {
  const box = (name) =>
    probe(name, '15-text')
      .elements.filter((element) => element.type === 'text')
      .at(-1).box;
  const cite = (list) => `[${list.join(',')}]`;

  it('rates it medium, because the s6 and s10 probes differ as recorded', () => {
    const [s6, s10] = ['s6-desktop-fresh', 's10-desktop-r76-15'];
    expect(strip(probe(s10, '15-text'))).not.toBe(strip(probe(s6, '15-text')));
    const [dx, dy] = probe(s6, '15-rect-selected').scroll;
    expect(probe(s10, '15-rect-selected').scroll).toEqual([0, 0]);
    const [x, y, ...size] = box(s10);
    expect([x - dx, y - dy, ...size]).toEqual(box(s6));
    const desktop = field(entry('B-06'), 'Desktop/mobile');
    expect(desktop).toContain(
      `15-text ${cite(box(s6))} in s6 and ${cite(box(s10))} in s10. s10's box minus ` +
        `(${String(dx)},${String(dy)}), the scroll that s6 had and s10 did not, equals s6's box ` +
        '[O, medium: the probes differ as recorded]',
    );
    expect(desktop).not.toMatch(/\[O, high\]/u);
    expect(field(entry('B-06'), 'Confidence')).toMatch(
      /^\[O\] high for the geometry \(s2 and s6 identical\); medium for the dark text box/u,
    );
  });

  it('follows the stated confidence rule, which does not allow for setup differences', () => {
    expect(doc('methodology.md')).toContain(
      'Results that match only once a setup difference is allowed for (another scroll, other ' +
        'styles) differ, as B-06 and B-34 show',
    );
    expect(field(entry('B-34'), 'Confidence')).toMatch(/^\[O\] medium\./u);
  });
});
