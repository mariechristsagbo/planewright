// Checks the mobile scenarios 60 and 61: Undo and Redo after adding a selection to the library
// and after placing the item (R-15), and the offline state applied again after 50's offline
// reload (R-57). Both name only driver steps, never navigate, reload or emulate, and are not
// runLast; 60 touches only the controls 58 used, and 61 sends no input at all. No browser is
// started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;
const kindsOf = (name) => stepsOf(name).map((step) => step.do);

const UNDO = '60-library-undo-mobile';
const REAPPLY = '61-offline-reapply-mobile';
const OFFLINE = '50-offline-reload-mobile';
const ADD_TILE = '136,214';
const ASSERT = {
  do: 'assertMetrics',
  expect: {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    screenWidth: 390,
    screenHeight: 844,
    orientationType: 'portrait-primary',
    orientationAngle: 0,
    maxTouchPoints: 5,
    coarsePointer: true,
    canvasBacking: true,
  },
};
const INPUT = ['tap', 'touchDrag', 'touchPath', 'type', 'key', 'role', 'selectOption'];
// One read of each kind may use a label (timeline-summary.mjs warns on a repeat within a kind).
const labelled = (name) => stepsOf(name).filter((step) => step.label);
// The first step after `i` that is not a wait.
const nextRead = (steps, i) => steps.slice(i + 1).find((step) => step.do !== 'wait');

describe('scenarios 60 and 61', () => {
  it.each([UNDO, REAPPLY])('%s names only driver steps and is not runLast', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each([UNDO, REAPPLY])('%s never navigates, reloads, emulates or reaches a file', (name) => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'download'];
    refused.push('selector', 'grantClipboard', 'clipboard', 'fileChooser', 'dropFile');
    refused.push('acceptDialog', 'click', 'move', 'drag', 'path', 'wheel');
    for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
    for (const step of stepsOf(name)) expect(step.role === 'link').toBe(false);
  });

  it.each([UNDO, REAPPLY])('%s labels each read once per kind, with its own number', (name) => {
    const reads = labelled(name).map((step) => `${step.do}:${step.label}`);
    expect(reads.length).toBeGreaterThan(0);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled(name)) {
      expect(label.startsWith(`${name.slice(0, 2)}-`), label).toBe(true);
    }
  });
});

describe('Undo and Redo after the library item (60)', () => {
  const steps = stepsOf(UNDO);
  const roles = steps.filter((step) => step.do === 'role');
  const taps = steps.filter((step) => step.do === 'tap').map((step) => step.at.join(','));

  it('asserts the portrait metrics first and last, and never goes offline', () => {
    expect(steps[0]).toEqual(ASSERT);
    expect(steps.at(-1)).toEqual(ASSERT);
    expect(kindsOf(UNDO)).not.toContain('offline');
  });

  it("clicks only 58's controls and Undo and Redo, by exact name, and types nothing", () => {
    const names = new Set(roles.map((step) => `${step.role}:${step.name}`));
    expect(names).toEqual(
      new Set(['button:Library', 'button:Close', 'button:Undo', 'button:Redo']),
    );
    for (const step of roles) expect(step.exact).toBe(true);
    expect(kindsOf(UNDO).filter((kind) => kind === 'touchDrag')).toHaveLength(1);
    for (const kind of ['type', 'key', 'touchPath', 'selectOption']) {
      expect(kindsOf(UNDO)).not.toContain(kind);
    }
    expect(new Set(taps)).toEqual(new Set(['218,812', ADD_TILE, '300,300']));
    expect(taps.filter((at) => at === ADD_TILE)).toHaveLength(2);
  });

  it('presses Undo then Redo after the add and after the placement, reading after each', () => {
    const presses = steps
      .map((step, i) => [step, i])
      .filter(([step]) => step.do === 'role' && ['Undo', 'Redo'].includes(step.name));
    expect(presses.map(([step]) => step.name)).toEqual(['Undo', 'Redo', 'Undo', 'Redo']);
    for (const [step, i] of presses) {
      const read = nextRead(steps, i);
      expect(read.do, `${step.name} at ${String(i)}`).toBe('scene');
      expect(steps[steps.indexOf(read) + 1].do).toBe('appState');
    }
    const tiles = steps.map((step, i) => [step, i]).filter(([s]) => s.at?.join(',') === ADD_TILE);
    expect(presses[0][1]).toBeGreaterThan(tiles[0][1]);
    expect(presses[1][1]).toBeLessThan(tiles[1][1]);
    expect(presses[2][1]).toBeGreaterThan(tiles[1][1]);
  });

  it('closes the sidebar before the first Undo and deselects before the second add-tile tap', () => {
    const at = (pred, from = 0) => steps.findIndex((step, i) => i >= from && pred(step));
    const firstTile = at((s) => s.at?.join(',') === ADD_TILE);
    const firstUndo = at((s) => s.name === 'Undo');
    const close = at((s) => s.name === 'Close', firstTile);
    expect(close).toBeGreaterThan(firstTile);
    expect(close).toBeLessThan(firstUndo);
    const secondTile = at((s) => s.at?.join(',') === ADD_TILE, firstTile + 1);
    const deselect = at((s) => s.at?.join(',') === '300,300', firstUndo);
    const reopen = at((s) => s.name === 'Library', deselect);
    expect(deselect).toBeLessThan(reopen);
    expect(reopen).toBeLessThan(secondTile);
  });
});

describe('the offline state applied again (61)', () => {
  const steps = stepsOf(REAPPLY);
  const offline = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'offline');

  it('sends no input and repeats the offline value that 50 left before its reload', () => {
    for (const kind of [...INPUT, 'assertMetrics']) expect(kindsOf(REAPPLY)).not.toContain(kind);
    expect(stepsOf(OFFLINE).filter((step) => step.do === 'offline')).toEqual([
      { do: 'offline', value: true },
    ]);
    expect(offline.map(([step]) => step)).toEqual([{ do: 'offline', value: true }]);
  });

  it('reads the connection before the step and again after a wait of at least 6 s', () => {
    const [, i] = offline[0];
    expect(steps.slice(0, i).filter((s) => s.do === 'connectivity')).toEqual([
      { do: 'connectivity', label: '61-reloaded' },
    ]);
    const after = steps.slice(i + 1);
    const waited = after
      .slice(
        0,
        after.findIndex((s) => s.do !== 'wait'),
      )
      .reduce((ms, s) => ms + s.ms, 0);
    expect(waited).toBeGreaterThanOrEqual(6000);
    expect(nextRead(steps, i)).toEqual({ do: 'connectivity', label: '61-reapplied' });
    const reads = after.map((step) => step.do);
    expect(reads).toEqual(expect.arrayContaining(['scene', 'appState', 'aria', 'screenshot']));
  });
});
