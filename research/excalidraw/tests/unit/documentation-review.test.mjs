// Checks the claims that the review of cb11dff found unsupported or contradictory, against the
// committed evidence and scenario files. Each check fails if the corrected wording regresses or
// if the evidence it rests on changes.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const evidence = (name) => JSON.parse(read(`docs/reverse-engineering/evidence/${name}`));
const session = (name) => evidence('sessions.json').sessions.find((s) => s.session === name);
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const doc = (name) => flat(read(`docs/reverse-engineering/${name}`));
const entry = (id) =>
  read('docs/reverse-engineering/behavior-analysis.md')
    .split(/^### /mu)
    .find((section) => section.startsWith(id));
const field = (text, name) => flat(text.split(`- **${name}:**`)[1].split(/\n- \*\*/u)[0]);
const row = (id) =>
  read('docs/reverse-engineering/residual-matrix.md')
    .split('\n')
    .find((line) => line.startsWith(`| ${id} |`));
const rawOnly = () =>
  doc('limitations.md').split('Facts read only from raw records')[1].slice(0, 2500);
const SCENARIOS = 'research/excalidraw/scenarios';
const scenario = (name) => JSON.parse(read(`${SCENARIOS}/${name}.json`));

describe('scenario descriptions', () => {
  it('claim nothing about what a reload keeps', () => {
    for (const name of readdirSync(join(ROOT, SCENARIOS))) {
      const { description } = JSON.parse(read(`${SCENARIOS}/${name}`));
      expect(description, name).not.toMatch(/persist across the reload|dialogs do not/u);
    }
  });

  it('say that 09b never ran, because no mobile session reloaded', () => {
    for (const name of ['s3-mobile', 's4-dpr-probe', 's7-mobile-fresh']) {
      expect(session(name).steps.byKind.reload ?? 0, name).toBe(0);
    }
    expect(scenario('09b-reload-and-verify-mobile').description).toContain('It never ran');
  });

  it('count the 00c runs in s6 from its emulate steps', () => {
    // 00 emulates once; every other s6 emulate step is the first step of a 00c run.
    const runs = session('s6-desktop-fresh').steps.byKind.emulate - 1;
    expect(runs).toBe(2);
    expect(scenario('00c-reemulate-and-reload-desktop').description).toContain('Used twice in s6');
  });

  it('describe the current capture rule for the collaboration scenarios', () => {
    for (const name of ['08-collaboration-desktop', '08b-collaboration-stop-attempt']) {
      const { description } = scenario(name);
      expect(description, name).not.toMatch(/unless every requested mask yields a visible box/u);
      expect(description, name).toContain('every element that may show the value');
    }
  });
});

describe('the merged 02-tool-probe reads', () => {
  it('make no claim about the tool or selection just after a drag', () => {
    const reads = scenario('02-shapes-desktop').steps.filter(
      (step) => step.do === 'appState' && step.label === '02-tool-probe',
    );
    expect(reads).toHaveLength(3);
    const probe = evidence('probes-s6-desktop-fresh.json').find((p) => p.label === '02-tool-probe');
    expect([probe.tool, probe.selected]).toEqual(['selection', 1]);
    const state = field(entry('B-01'), 'State and related effects');
    expect(state).not.toMatch(/after the rectangle drag, 1 element is selected/u);
    expect(state).toContain('Not observed (R-02, R-29)');
    expect(state).toContain('three times');
    expect(doc('backlog.md')).not.toContain('[O, rectangle only]');
    expect(rawOnly()).toContain('02-tool-probe');
    expect(row('R-02')).toContain('02-tool-probe');
  });
});

describe('raw-only labels', () => {
  const committed = () =>
    readdirSync(join(ROOT, 'docs/reverse-engineering/evidence')).map((name) =>
      read(`docs/reverse-engineering/evidence/${name}`),
    );

  it('mark the clipboard shape as raw-only, because no committed file holds it', () => {
    for (const text of committed()) expect(text).not.toContain('excalidraw/clipboard');
    expect(field(entry('B-26'), 'State and related effects')).toContain('[O, raw timelines only');
    expect(doc('backlog.md')).toContain('typed JSON payload [O, raw timelines only]');
    expect(rawOnly()).toContain('the clipboard shape after Ctrl+C');
  });

  it('do not mark the cache counts as raw-only, because rea-windows.json holds them', () => {
    const counts = evidence('rea-windows.json')
      .windows.map((w) => w.cache_names)
      .filter((n) => n !== undefined);
    expect(counts).toEqual(expect.arrayContaining([3, 2]));
    expect(doc('network-analysis.md')).not.toContain('from raw REA records only, 3');
    expect(field(entry('B-31'), 'Immediate result')).not.toMatch(/3 caches \[O, raw only\]/u);
    expect(rawOnly()).not.toContain("inspection's 3 caches");
    for (const name of ['network-analysis.md', 'limitations.md']) {
      expect(doc(name), name).toMatch(/cache counts?\b[^.]*evidence\/rea-windows\.json/u);
    }
  });
});

describe('confidence labels', () => {
  const failures = (name, step) =>
    session(name)
      .steps.failures.filter((f) => f.step === step)
      .reduce((n, f) => n + f.count, 0);

  it('rate B-32 on s6 alone, because s1 recorded no failed steps', () => {
    expect(session('s1-desktop').steps.failures).toEqual([]);
    expect([
      failures('s6-desktop-fresh', 'download'),
      failures('s6-desktop-fresh', 'fileChooser'),
    ]).toEqual([3, 1]);
    const b32 = entry('B-32');
    expect(field(b32, 'Confidence')).toContain('[O] medium');
    expect(field(b32, 'Reproduction')).not.toMatch(/s1, s6: failed/u);
    expect(field(b32, 'Reproduction')).toContain(
      '3 failed download steps and 1 failed fileChooser step',
    );
    expect(doc('limitations.md')).not.toContain('Steps did fail in s1:');
  });

  it('do not rest the secondary-surface rating on the committed line counts', () => {
    const lines = (name, file) => session(name).aria_snapshots.find((a) => a.name === file).lines;
    expect([
      lines('s1-desktop', 'ui-01-main-menu.yml'),
      lines('s6-desktop-fresh', 'ui-01-main-menu.yml'),
    ]).toEqual([97, 89]);
    const inventory = doc('feature-inventory.md');
    expect(inventory).not.toContain('[O, high unless noted; s1 and s6]');
    expect(inventory).toContain('ui-01-main-menu has 97 lines in s1 and 89 in s6');
    expect(inventory).toContain('rests on that raw comparison');
    expect(rawOnly()).toContain('the s1 and s6 ARIA snapshot comparison');
  });

  it('keep the select-all reading of B-13 a hypothesis, because no probe ran before the copy', () => {
    const steps = scenario('06-clipboard-io-persistence-desktop').steps.map((step) => step.do);
    const [selectAll, copy] = [steps.indexOf('key'), steps.indexOf('key') + 1];
    expect(steps.slice(selectAll, copy + 1)).toEqual(['key', 'key']);
    const b13 = entry('B-13');
    expect(b13.split('\n')[0]).not.toContain('Select all ignores locked elements');
    expect(field(b13, 'Confidence')).toMatch(/high for the paste contents.*\[H\]/u);
    expect(doc('backlog.md')).not.toContain('Select-all excludes locked elements [O]');
    expect(doc('backlog.md')).toContain('whether select-all or copy excludes it is open (R-33)');
  });
});

describe('factual statements', () => {
  const loads = (name) => {
    const kinds = session(name).steps.byKind;
    return (kinds.goto ?? 0) + (kinds.reload ?? 0);
  };
  const all = () => evidence('sessions.json').sessions.map((s) => s.session);

  it('count the reference page loads from the committed steps', () => {
    expect(loads('s6-desktop-fresh')).toBe(9);
    const total = all().reduce((sum, name) => sum + loads(name), 0);
    expect(total).toBe(17);
    const text = doc('methodology.md');
    expect(text).toContain(`navigated ${String(total)} times in total`);
    expect(text).toContain('s6: 9 including the reloads');
  });

  it('do not say that every probe waits 700–800 ms', () => {
    const steps = scenario('02-shapes-desktop').steps;
    const early = steps.filter(
      (step, i) => step.label === '02-tool-probe' && ['key', 'drag'].includes(steps[i - 1]?.do),
    );
    expect(early).toHaveLength(2);
    expect(doc('limitations.md')).not.toContain('Every probe waits 700–800 ms');
    expect(doc('limitations.md')).toContain('straight after a key press and a drag');
  });

  it('describe the aborted s6 runs by the step that failed', () => {
    const first = (name) => scenario(name).steps[0].do;
    expect(['01-ui-inventory-desktop', '12-panel-edge-drag-desktop'].map(first)).toEqual([
      'assertMetrics',
      'assertMetrics',
    ]);
    expect(first('00b-reload-and-verify-desktop')).toBe('reload');
    const readme = flat(read('research/excalidraw/README.md'));
    expect(readme).not.toContain('Aborted runs stopped at their first step and changed nothing');
    expect(readme).toContain('00b after its reload');
    expect(doc('README.md')).not.toContain('replayed every scenario');
  });

  it('cite no withdrawn network entry', () => {
    for (const name of ['feature-inventory.md', 'behavior-analysis.md', 'backlog.md']) {
      expect(doc(name), name).not.toMatch(/\bN-\d\d\b/u);
    }
  });

  it('state where s7 asserted the mobile metrics instead of every scenario boundary', () => {
    expect(session('s7-mobile-fresh').steps.byKind.assertMetrics).toBe(5);
    const s10b = scenario('10b-mobile-screenshot-for-rea').steps.map((step) => step.do);
    expect(s10b).not.toContain('assertMetrics');
    for (const name of ['limitations.md', 'feature-inventory.md', 'checkpoint.md']) {
      const text = doc(name);
      expect(text, name).not.toMatch(/start and end of every scenario|every scenario boundary/u);
      expect(text, name).toContain('at 5 points');
    }
    const claims = ['methodology.md', 'checkpoint.md'].map(doc);
    claims.push(flat(read('research/excalidraw/README.md')));
    for (const text of claims) {
      expect(text).not.toMatch(/every later scenario asserts|asserted at every scenario start/iu);
    }
  });
});

describe('retained copies of the room-bearing records', () => {
  it('are described the same way in every document', () => {
    expect(doc('checkpoint.md')).toMatch(/securely deleted[^.]*\./u);
    expect(doc('methodology.md')).not.toContain('remaining copy outside the workspace');
    expect(doc('methodology.md')).toContain('No copy is known to remain');
    expect(doc('rea-findings.md')).not.toContain('cache copy outside the workspace remains');
    expect(doc('rea-findings.md')).toContain('deleted with the capture transcript');
  });
});
