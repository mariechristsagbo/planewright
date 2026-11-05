// Checks the claims that the review of f1562ed found stale, overstated or unguarded, against the
// committed evidence: each expectation is derived from the evidence index, so a claim fails if
// its wording regresses or if the evidence it rests on changes.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  R76,
  RE,
  ROOT,
  cells,
  digests,
  doc,
  entry,
  evidence,
  field,
  flat,
  lines,
  probe,
  read,
  session,
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

const PAGE = 'https://excalidraw.com';
const requests = (name, pick) =>
  session(name).network.filter((e) => e.event === 'request' && pick(e));
const count = (list) => list.reduce((sum, e) => sum + e.count, 0);
const short = (name) => name.split('-')[0];
// Session names as the documents list them: runs of three or more as a range ("s8–s10").
const sessionList = (names, last = 'and') => {
  const numbers = names.map((name) => Number(name.slice(1)));
  const parts = [];
  let start = 0;
  while (start < numbers.length) {
    let end = start;
    while (numbers[end + 1] === numbers[end] + 1) end += 1;
    if (end - start >= 2) {
      parts.push(`s${String(numbers[start])}–s${String(numbers[end])}`);
    } else {
      for (const n of numbers.slice(start, end + 1)) parts.push(`s${String(n)}`);
    }
    start = end + 1;
  }
  return parts.length < 2
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} ${last} ${parts.at(-1)}`;
};

describe('the s11 page-origin requests', () => {
  const s11 = 's11-mobile-r76-14';
  const network = (name) =>
    requests(name, (e) => e.origin === PAGE && e.fromServiceWorker === false);

  it('split the service-worker requests by type, as the network analysis says', () => {
    const worker = requests(s11, (e) => e.origin === PAGE && e.fromServiceWorker === true);
    const byType = {};
    for (const e of worker) byType[e.type] = (byType[e.type] ?? 0) + e.count;
    expect(Object.keys(byType).sort()).toEqual(['fetch', 'script']);
    for (const e of worker.filter((w) => w.type === 'fetch'))
      expect(e.path).toMatch(/^\/assets\//u);
    expect(doc('network-analysis.md')).toContain(
      `also had ${String(count(worker))} true: ${String(byType.fetch)} fetch requests for ` +
        `/assets/ chunks and ${String(byType.script)} script`,
    );
  });

  it('name the one network fetch that s11 had beyond the desktop first load', () => {
    const desktop = new Set(network('s10-desktop-r76-15').map((e) => e.path));
    const extra = network(s11).filter((e) => !desktop.has(e.path));
    expect(extra.map(({ type, count: n }) => [type, n])).toEqual([['fetch', 1]]);
    const shape = extra[0].path.replace(/-[\w-]{8}\.json$/u, '-*.json');
    const text = doc('network-analysis.md');
    expect(text).toContain(`each of s2–s10; s11 had ${String(count(network(s11)))}`);
    expect(text).toContain(`one page fetch of ${shape}`);
  });
});

describe('the session lists of the network analysis', () => {
  const all = () => evidence('sessions.json').sessions.map((s) => s.session);
  const fontIn = (name) =>
    requests(name, (e) => e.path?.startsWith('/oss/fonts/CascadiaCode/')).length;
  const beacons = (name, keys) =>
    count(
      requests(
        name,
        (e) => e.origin === 'https://queue.simpleanalyticscdn.com' && e.queryKeys.length === keys,
      ),
    );

  it('name the sessions that loaded the Cascadia Code font, and those that did not', () => {
    const [loaded, not] = [all().filter(fontIn), all().filter((n) => !fontIn(n))].map((list) =>
      list.map(short),
    );
    expect(doc('network-analysis.md')).toContain(
      `plus an 8th, Cascadia Code, in ${sessionList(loaded)} (not ${sessionList(not, 'or')})`,
    );
  });

  it('name the sessions with the 24-key beacon besides s6', () => {
    const others = all()
      .filter((name) => name !== 's6-desktop-fresh' && beacons(name, 24) > 0)
      .map(short);
    const s6 = ['s6-desktop-fresh', 24];
    expect(doc('network-analysis.md')).toContain(
      `came ${String(beacons(...s6))} more times in s6 (${String(beacons(s6[0], 23) + beacons(...s6))} ` +
        `beacons in all) and also in ${sessionList(others)}`,
    );
  });
});

describe('the R-76 initial-page inspections', () => {
  const initial = (name) =>
    evidence(
      name === 's1-desktop'
        ? 'rea-inspect-initial.summary.json'
        : `rea-inspect-initial-${name}.summary.json`,
    );
  const other = (summary) => summary.scripts.filter((s) => !/\/index-[^/]+\.js$/u.test(s.url));

  it('list the scripts of s1 in every R-76 session, mobile included, except the main chunk', () => {
    const s1 = initial('s1-desktop');
    for (const run of R76) {
      expect(other(initial(run.name)), run.name).toEqual(other(s1));
      expect(initial(run.name).scripts, run.name).toHaveLength(s1.scripts.length);
    }
    expect(doc('limitations.md')).toContain(
      `list the same ${String(s1.scripts.length)} scripts in s1 and in s8–s11 except the main ` +
        'index-*.js chunk',
    );
  });
});

describe('the Clear canvas dialog in the feature inventory', () => {
  it('is rated high only while s7 and s11 give the same snapshot size and capture', () => {
    const shot = 'm15-dark-reset-confirm';
    const [s7, s11] = ['s7-mobile-fresh', 's11-mobile-r76-14'];
    const same =
      digests(s7).get(`${shot}.png`) === digests(s11).get(`${shot}.png`) &&
      lines(s7, `${shot}.yml`) === lines(s11, `${shot}.yml`);
    const row = read(`${RE}/feature-inventory.md`)
      .split('\n')
      .find((line) => line.startsWith('| Clear canvas dialog '));
    expect(flat(row)).toContain(
      same
        ? '[O, high], mobile dark in s7 and s11: identical snapshots and byte-identical captures'
        : '[O, medium]',
    );
  });
});

describe('the s11 requests set against its scenarios', () => {
  const s11 = 's11-mobile-r76-14';
  const rawOnly = () =>
    flat(read(`${RE}/limitations.md`).split('Facts read only from raw records')[1]).split(
      ' - REA MCP denied.',
    )[0];

  it('state the committed counts and label the placement as an inference from raw times', () => {
    const worker = requests(s11, (e) => e.fromServiceWorker === true);
    const page = count(worker.filter((e) => e.origin === PAGE));
    const font = worker.filter((e) => e.path?.startsWith('/oss/fonts/CascadiaCode/'));
    expect(count(worker)).toBe(page + count(font));
    const beacons = count(
      requests(s11, (e) => e.path === '/simple.gif' && e.queryKeys.length === 24),
    );
    const text = doc('network-analysis.md');
    expect(text).toContain(
      `s11's requests after its load [I, raw netlog and timeline times]. Of its ` +
        `${String(count(requests(s11, () => true)))} requests`,
    );
    expect(text).toContain(
      `every request that the service worker served, the ${String(page)} on the page origin ` +
        `and the Cascadia Code font, started between 04:54:12.0 and 04:54:19.7 UTC`,
    );
    expect(text).toContain(`The 24-key beacon came ${beacons === 2 ? 'twice' : String(beacons)}`);
    expect(text).toMatch(/This narrows R-64 and R-66 without isolating a trigger[^.]*\[U\]/u);
  });

  it('list the placement as raw-only and narrow R-64 and R-66 to it', () => {
    expect(rawOnly()).toContain('the driver netlog requests set against scenarios 12, 13, 15');
    expect(rawOnly()).toContain("and against 09, 10 and 14 in s11, s11's service-worker requests");
    const [r64, r66] = [cells('R-64'), cells('R-66')].map((row) => row.map(flat));
    expect(r64[6]).toContain('in s11 every request the service worker served started during');
    expect(r64[7]).toMatch(/a step of scenario 10 or a delay since the load/u);
    expect(r66[6]).toContain(
      "netlog request on any origin during 12, 13, 15 or s11's drawing in 10",
    );
    expect(r66[7]).toContain(
      "only the raw s11 netlog covers it: no request during scenario 10's touch drawing, pinch",
    );
  });
});
