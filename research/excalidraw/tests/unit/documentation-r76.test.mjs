// Checks the record of the second fresh-profile runs (R-76, sessions s8–s11) against the
// committed evidence and scenario files: each session's steps are exactly the scenarios of its
// row in the research README, each REA window covers its whole scenario, and the documents cite
// the numbers that the evidence holds.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const RE = 'docs/reverse-engineering';
const doc = (name) => flat(read(`${RE}/${name}`));
const evidence = (name) => JSON.parse(read(`${RE}/evidence/${name}`));
const session = (name) => evidence('sessions.json').sessions.find((s) => s.session === name);
const DIR = 'research/excalidraw/scenarios';
const FILES = readdirSync(join(ROOT, DIR)).map((file) => file.replace(/\.json$/u, ''));
const scenario = (id) => {
  const name = FILES.find((file) => file.startsWith(`${id}-`));
  return { name, ...JSON.parse(read(`${DIR}/${name}.json`)) };
};

// The R-76 sessions, the short name their README row uses and the scenario REA observed.
const R76 = [
  { name: 's8-desktop-r76-12', short: 's8', observed: '12' },
  { name: 's9-desktop-r76-13', short: 's9', observed: '13' },
  { name: 's10-desktop-r76-15', short: 's10', observed: '15' },
  { name: 's11-mobile-r76-14', short: 's11', observed: '14' },
];

// The scenario ids of a session's row in the README order table.
const order = (short) => {
  const row = read('research/excalidraw/README.md')
    .split('\n')
    .find((line) => line.includes(`(\`${short}\`)`));
  return row.split('|')[2].trim().split(' → ');
};
const tally = (steps) => {
  const out = {};
  for (const step of steps) out[step.do] = (out[step.do] ?? 0) + 1;
  return out;
};
const ms = (from, to) => Date.parse(to) - Date.parse(from);
const probes = (name) => evidence(`probes-${name}.json`);
const probe = (name, label) => probes(name).find((p) => p.label === label);
const entry = (id) =>
  read(`${RE}/behavior-analysis.md`)
    .split(/^### /mu)
    .find((section) => section.startsWith(id));
const field = (text, name) => flat(text.split(`- **${name}:**`)[1].split(/\n- \*\*/u)[0]).trim();
// The read time and label always differ between sessions; every other field must match.
const strip = (p) => JSON.stringify({ ...p, at: undefined, label: undefined });
const differing = (later, earlier) => {
  const byLabel = new Map(probes(earlier).map((p) => [p.label, p]));
  const shared = probes(later).filter((p) => byLabel.has(p.label));
  const labels = shared.filter((p) => strip(p) !== strip(byLabel.get(p.label))).map((p) => p.label);
  return { shared: shared.length, labels };
};
const range = (list) => `${String(Math.min(...list))}–${String(Math.max(...list))}`;

describe('the R-76 sessions', () => {
  it.each(R76)('$name ran exactly the scenarios of its README row, once loaded', (run) => {
    const steps = order(run.short).flatMap((id) => scenario(id).steps);
    const { steps: recorded } = session(run.name);
    expect(recorded.total).toBe(steps.length);
    expect(recorded.byKind).toEqual(tally(steps));
    expect(recorded.failed).toBe(0);
    expect((recorded.byKind.goto ?? 0) + (recorded.byKind.reload ?? 0)).toBe(1);
    expect(recorded.byKind.storage).toBeGreaterThan(0);
    expect(order(run.short)).toContain(run.observed);
  });

  it('are listed in the methodology with their step counts and one load each', () => {
    const text = doc('methodology.md');
    for (const run of R76) {
      expect(text).toContain(`${run.name} (${String(session(run.name).steps.total)})`);
    }
    expect(text).toContain('s7: 1, s8–s11: 1 each');
  });
});

describe('the R-76 REA windows', () => {
  const windows = () => evidence('rea-windows.json').windows;

  it.each(R76)(
    '$name has an initial-page inspection and a window over its whole scenario',
    (run) => {
      const own = windows().filter((w) => w.session === run.name);
      const initial = own.find((w) => w.file === 'r02-inspect-initial.json');
      expect(initial).toMatchObject({ operation: 'inspect_web_page', driver: { steps: 0 } });
      const during = own.find((w) => w.file === `r03-inspect-during-${run.observed}.json`);
      const { steps } = scenario(run.observed);
      expect(during.operation).toBe('inspect_web_page');
      expect(during.allowed_origins).toEqual(['https://excalidraw.com']);
      expect(during.driver).toMatchObject({
        steps: steps.length,
        failed: 0,
        by_kind: tally(steps),
      });
      expect(during.driver.probe_labels.sort()).toEqual(
        [...new Set(steps.map((step) => step.label).filter(Boolean))].sort(),
      );
      expect(ms(during.driver.previous_step.at, during.window.start)).toBeGreaterThan(0);
      const lead = ms(during.window.start, during.driver.first_step_at);
      const coverage = ms(during.network_coverage_started_at, during.driver.first_step_at);
      expect(coverage).toBeGreaterThan(0);
      expect(during).toMatchObject({ network_requests: 0, websocket_connections: 0 });
      expect(during.console_events).toBe(0);
      expect(doc('rea-findings.md')).toContain(
        `Armed ${String(lead)} ms before scenario ${run.observed}'s first step; all its ` +
          `${String(steps.length)} steps started inside it, and network coverage began ` +
          `${String(coverage)} ms before the first`,
      );
    },
  );
});

describe('scenarios 12 and 13 against s6', () => {
  it('cite the replay counts of s8 and s9', () => {
    const text = flat(read(`${RE}/behavior-analysis.md`));
    const twelve = differing('s8-desktop-r76-12', 's6-desktop-fresh');
    expect(twelve).toEqual({ shared: 5, labels: [] });
    expect(text).toContain('s8 shares 5 labels with s6, and 5 of 5 are identical');
    const thirteen = differing('s9-desktop-r76-13', 's6-desktop-fresh');
    expect(thirteen.labels).toEqual(['13a-t200']);
    const same = thirteen.shared - thirteen.labels.length;
    expect(text).toContain(
      `s9 shares ${String(thirteen.shared)} labels with s6, and ${String(same)} of ` +
        `${String(thirteen.shared)} are identical: all of scenario 13 except 13a-t200`,
    );
  });

  it('rate B-02 high only while s6 and s8 agree on every scenario 12 label', () => {
    const labels = scenario('12')
      .steps.filter((step) => step.label)
      .map((step) => step.label);
    const { shared, labels: differ } = differing('s8-desktop-r76-12', 's6-desktop-fresh');
    expect(shared).toBe(new Set(labels).size);
    const rating = field(entry('B-02'), 'Confidence');
    expect(rating).toMatch(differ.length === 0 ? /^\[O\] high: s6 and s8/u : /medium/u);
    expect(field(entry('B-02'), 'Reproduction')).toContain('scenario 12 (s6, s8)');
  });
});

// For each trial, the offsets of the reads after the first and whether the new shape was there.
const trials = (name) =>
  ['13a', '13b', '13c'].map((trial) => {
    const t0 = probe(name, `${trial}-t0`);
    const final = probe(name, `${trial}-t1500`).elements.length;
    return ['t100', 't200', 't300'].map((key) => {
      const p = probe(name, `${trial}-${key}`);
      return { trial, key, at: ms(t0.at, p.at), saved: p.elements.length === final };
    });
  });

describe('the scenario 13 save timing', () => {
  it('give the s9 save timing read by read, and keep the timing medium while it differs', () => {
    const reads = trials('s9-desktop-r76-13').flat();
    const at = (key, saved) =>
      reads.filter((r) => r.key === key && r.saved === saved).map((r) => r.at);
    expect(at('t100', true)).toEqual([]);
    expect(at('t300', false)).toEqual([]);
    const early = reads.filter((r) => r.key === 't200' && r.saved);
    expect(early.map((r) => r.trial)).toEqual(['13a']);
    const text = field(entry('B-30'), 'Immediate result');
    expect(text).toContain(
      `absent at 0 and ${range(at('t100', false))} ms in 3 of 3 trials, absent at ` +
        `${range(at('t200', false))} ms in 2 and already present at ${String(early[0].at)} ms in ` +
        `1 (13a), and present at ${range(at('t300', true))} ms and later in 3 of 3`,
    );
    const s6 = trials('s6-desktop-fresh').flat();
    expect(s6.some((r) => r.key === 't200' && r.saved)).toBe(false);
    expect(field(entry('B-30'), 'Confidence')).toMatch(/\[O\] medium for the timing: s6 and s9/u);
  });

  it('carry the two-session bounds into the backlog and hypothesis A-06', () => {
    const reads = [...trials('s6-desktop-fresh'), ...trials('s9-desktop-r76-13')].flat();
    const offsets = (key) => reads.filter((r) => r.key === key).map((r) => r.at);
    const absent = reads.filter((r) => r.key === 't200' && !r.saved).map((r) => r.at);
    const backlog = flat(read(`${RE}/backlog.md`));
    expect(backlog).toContain(
      `landed after the ${range(offsets('t100'))} ms read and by the ${range(offsets('t300'))} ` +
        `ms read in 6 of 6 trials (s6 and s9); after the ${range(absent)} ms read in 5 of them`,
    );
    expect(flat(read(`${RE}/architecture-hypotheses.md`))).toContain(
      `absent at the ${range(offsets('t100'))} ms read and present at the ` +
        `${range(offsets('t300'))} ms read after the first post-drag read in 6 of 6 trials`,
    );
  });
});

const lines = (name, file) => session(name).aria_snapshots.find((a) => a.name === file)?.lines;
const digests = (name) => new Map(session(name).screenshots.map((s) => [s.name, s.sha256]));

describe('scenario 15 against s6', () => {
  it('cites the replay count and the drawn geometry once the scroll is subtracted', () => {
    const { shared, labels } = differing('s10-desktop-r76-15', 's6-desktop-fresh');
    expect(labels).toHaveLength(shared);
    const text = flat(read(`${RE}/behavior-analysis.md`));
    expect(text).toContain(`s10 shares ${String(shared)} labels with s6, and 0 of`);
    const [dx, dy] = probe('s6-desktop-fresh', '15-rect-selected').scroll;
    expect(probe('s10-desktop-r76-15', '15-rect-selected').scroll).toEqual([0, 0]);
    expect(text).toContain(`With s6's scroll (${String(dx)},${String(dy)}) subtracted`);
    const drawn = probe('s10-desktop-r76-15', '15-text').elements;
    const earlier = probe('s6-desktop-fresh', '15-text').elements.slice(-drawn.length);
    drawn.forEach((element, i) => {
      const [x, y, width, height] = element.box;
      expect([x - dx, y - dy, width, height]).toEqual(earlier[i].box);
      const { box, style, ...rest } = element;
      expect({ ...earlier[i], box, style }).toEqual({ ...rest, box, style });
      expect(style).not.toEqual(earlier[i].style);
    });
    for (const label of ['15-rect-selected', '15-end']) {
      const pick = (p) => [p.selected, p.tool, p.zoom, p.theme];
      expect(pick(probe('s10-desktop-r76-15', label))).toEqual(
        pick(probe('s6-desktop-fresh', label)),
      );
    }
  });

  it('rates only the surfaces whose snapshots can be identical as high', () => {
    for (const file of ['dark-11-panel-text.yml', 'dark-12-preferences.yml']) {
      expect(lines('s10-desktop-r76-15', file), file).toBe(lines('s6-desktop-fresh', file));
    }
    // The Fill group (5 lines) is in s6's rectangle snapshots only.
    for (const file of ['07-element-context-menu', '08-panel-rect', '09-panel-rect-scrolled']) {
      const name = `dark-${file}.yml`;
      expect(lines('s6-desktop-fresh', name) - lines('s10-desktop-r76-15', name), name).toBe(5);
    }
    expect(field(entry('B-34'), 'Confidence')).toMatch(
      /^\[O\] medium\. The menu entries are identical in s6 and s10, but the snapshots are not/u,
    );
    expect(field(entry('B-03'), 'Confidence')).toContain('high for the text hint');
    const inventory = flat(read(`${RE}/feature-inventory.md`));
    expect(inventory).toContain('the text section [O, high], identical in s6 and s10');
    expect(inventory).toContain('[O, medium], dark in s6 and s10: the entries are identical');
  });
});

describe('the mobile chain against s7 and s3', () => {
  const scrollX = (name, label) => probe(name, label).scroll[0];
  const withoutX = (p) => strip({ ...p, scroll: [null, p.scroll?.[1]] });

  it('cites the replay counts and a difference in scrollX only', () => {
    const vs7 = differing('s11-mobile-r76-14', 's7-mobile-fresh');
    for (const label of vs7.labels) {
      expect(withoutX(probe('s11-mobile-r76-14', label)), label).toBe(
        withoutX(probe('s7-mobile-fresh', label)),
      );
    }
    const [x11, x7] = [
      scrollX('s11-mobile-r76-14', '14-end'),
      scrollX('s7-mobile-fresh', '14-end'),
    ];
    const same = vs7.shared - vs7.labels.length;
    const text = flat(read(`${RE}/behavior-analysis.md`));
    expect(text).toContain(
      `s11 shares ${String(vs7.shared)} labels with s7, and ${String(same)} of ` +
        `${String(vs7.shared)} are identical; the other ${String(vs7.labels.length)} differ only ` +
        `in scrollX (${String(x11).replace('-', '−')} in s11, ${String(x7).replace('-', '−')} in s7)`,
    );
    const vs3 = differing('s11-mobile-r76-14', 's3-mobile');
    expect(vs3.labels).toEqual([]);
    expect(text).toContain(`shares ${String(vs3.shared)} labels with s3, and 6 of 6 are identical`);
  });

  it('rates the mobile dialogs high from equal snapshots and byte-identical captures', () => {
    const later = session('s11-mobile-r76-14').aria_snapshots;
    for (const { name, lines: count } of later) {
      expect(count, name).toBe(lines('s7-mobile-fresh', name));
    }
    const earlier = digests('s7-mobile-fresh');
    const same = [...digests('s11-mobile-r76-14')].filter(([n, d]) => earlier.get(n) === d);
    const names = same.map(([name]) => name);
    for (const shot of ['m11-dark-help', 'm13-dark-command-palette', 'm15-dark-reset-confirm']) {
      expect(names).toContain(`${shot}.png`);
    }
    expect(field(entry('B-35'), 'Confidence')).toMatch(/^\[O\] high: s7 and s11 give identical/u);
    const inventory = flat(read(`${RE}/feature-inventory.md`));
    expect(inventory).toContain(`all ${String(later.length)} s11 snapshots match s7's`);
    expect(inventory).toContain(
      'Help, Command palette and Clear canvas captures are byte-identical',
    );
  });

  it('names the sessions whose initial desktop capture is byte-identical', () => {
    const shared = digests('s6-desktop-fresh').get('d01-initial-light.png');
    const same = evidence('sessions.json')
      .sessions.filter((s) => digests(s.session).get('d01-initial-light.png') === shared)
      .map((s) => s.session.split('-')[0]);
    expect(same).toEqual(['s1', 's5', 's6', 's8', 's9', 's10']);
    expect(flat(read(`${RE}/feature-inventory.md`))).toContain(
      'd01-initial-light is byte-identical in s1, s5, s6 and s8–s10',
    );
  });
});
