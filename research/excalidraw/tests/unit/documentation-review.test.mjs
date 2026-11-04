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
