// Checks the claims that the review of f1562ed found stale, overstated or unguarded, against the
// committed evidence: each expectation is derived from the evidence index, so a claim fails if
// its wording regresses or if the evidence it rests on changes.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RE, ROOT, cells, digests, doc, evidence, flat } from './r76-evidence.mjs';

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
