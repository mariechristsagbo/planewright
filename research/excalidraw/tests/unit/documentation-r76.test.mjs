// Checks the record of the second fresh-profile runs (R-76, sessions s8–s11) against the
// committed evidence and scenario files: each session's steps are exactly the scenarios of its
// row in the research README, each REA window covers its whole scenario, and the documents cite
// the numbers that scenarios 12 and 13 produced.
import { describe, expect, it } from 'vitest';

import {
  cells,
  differing,
  doc,
  entry,
  evidence,
  field,
  flat,
  ms,
  order,
  probe,
  R76,
  range,
  RE,
  read,
  scenario,
  session,
  tally,
} from './r76-evidence.mjs';

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

// Whether a second run holds what R-76 asks for: a storage read, an initial-page inspection and a
// REA window over its scenario.
const holds = (run) => {
  const own = evidence('rea-windows.json').windows.filter((w) => w.session === run.name);
  return (
    session(run.name).steps.byKind.storage > 0 &&
    own.some((w) => w.file === 'r02-inspect-initial.json') &&
    own.some((w) => w.file === `r03-inspect-during-${run.observed}.json`)
  );
};

describe('the R-76 record', () => {
  it('marks R-76 done only while every second run holds its reads and windows', () => {
    const done = R76.every(holds);
    const [, , , , columns, status, cited, , next, priority] = cells('R-76');
    expect([columns, status, priority]).toEqual(
      done ? ['✅/✅/✅', '✅', '—'] : [columns, '🟡', '2'],
    );
    for (const run of R76) {
      const earlier = run.short === 's11' ? 's7' : 's6';
      expect(cited).toContain(`${run.observed} (${earlier}, ${run.short})`);
    }
    expect(next).toMatch(/^None planned; the open points are tracked in R-54/u);
  });

  it('records the runs, their bounds and their cleanup in the checkpoint', () => {
    const checkpoint = read(`${RE}/checkpoint.md`);
    const text = flat(checkpoint.split('## R-76 runs (s8–s11)\n')[1].split(/^## /mu)[0]);
    for (const run of R76) expect(text).toContain(run.name);
    expect(text).toContain(
      'Export to Link, the generation features and collaboration were not used',
    );
    expect(text).toContain('the netlogs hold 0 .map requests');
    expect(text).toMatch(/Cleanup, checked after each session/u);
    expect(text).toContain('no independent review covers them yet');
    expect(flat(checkpoint)).toContain('(R-76 ✅)');
    expect(flat(checkpoint)).toContain('No review covers the R-76 commits after 935f2fc');
  });
});
