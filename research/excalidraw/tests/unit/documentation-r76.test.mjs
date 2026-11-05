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
