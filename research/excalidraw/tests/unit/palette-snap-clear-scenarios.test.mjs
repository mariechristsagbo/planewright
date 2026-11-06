// Checks the mobile scenarios 71, 72 and 73: commands run from the command palette (R-07), the
// effect of Snap to objects and Snap to midpoints on a drag (R-19), and Clear canvas confirmed
// with Undo (R-13). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const NAMES = {
  71: '71-command-palette-mobile',
  72: '72-snap-drag-midpoints-mobile',
  73: '73-clear-canvas-mobile',
};
const bodies = Object.fromEntries(Object.entries(NAMES).map(([n, name]) => [n, load(name)]));
const kindsOf = (n) => bodies[n].steps.map((step) => step.do);
const rolesOf = (n) => bodies[n].steps.filter((s) => s.do === 'role').map((s) => s.name);
const at = (step) => step.at?.join(',');
const BOX = 'Search menus, commands, and discover hidden gems';

describe('scenarios 71, 72 and 73', () => {
  it.each(Object.keys(NAMES))(
    '%s names only driver steps and asserts the portrait metrics first and last',
    (n) => {
      const { steps } = bodies[n];
      const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
      for (const kind of kindsOf(n)) expect(known.has(kind), kind).toBe(true);
      expect(bodies[n].runLast).toBeUndefined();
      expect(steps[0].do).toBe('assertMetrics');
      expect(steps.at(-1)).toEqual(steps[0]);
    },
  );

  it.each(Object.keys(NAMES))('%s never navigates, uploads or reaches a file', (n) => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'wheel'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'click');
    refused.push('grantClipboard', 'clipboard', 'selector', 'touchHold', 'drag', 'path');
    for (const kind of refused) expect(kindsOf(n)).not.toContain(kind);
    const labelled = bodies[n].steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith(`${n}-`)).toBe(true);
  });

  it('lets only 71 type, and only 71 stop at its first failed step', () => {
    expect(bodies[71].continueOnError).toBe(false);
    expect([bodies[72].continueOnError, bodies[73].continueOnError]).toEqual([true, true]);
    expect([kindsOf(72), kindsOf(73)].flat()).not.toContain('type');
  });
});

describe('the command palette in 71', () => {
  const { steps } = bodies[71];
  const typed = steps.map((s, i) => [s, i]).filter(([s]) => s.do === 'type');

  it('types four command names, each right after clicking the search box by name', () => {
    expect(typed.map(([s]) => s.text)).toEqual([
      'Zoom to selection',
      'Reset zoom',
      'Zoom to fit all elements',
      'Reset zoom',
    ]);
    for (const [, i] of typed) {
      expect(steps[i - 1]).toEqual({ do: 'role', role: 'textbox', name: BOX, exact: true });
      const opened = steps.findLastIndex((s, k) => k < i && s.name === 'Command palette');
      expect(steps[opened].role).toBe('menuitem');
      expect(at(steps[opened - 2])).toBe('28,28');
    }
  });

  it('presses Enter after each command and reads the app state, ending with Reset zoom', () => {
    for (const [, i] of typed) {
      const enter = steps.findIndex((s, k) => k > i && s.do === 'key');
      expect(steps[enter]).toEqual({ do: 'key', key: 'Enter' });
      expect(steps[enter + 2].do).toBe('appState');
    }
    expect(steps.filter((s) => s.do === 'key').every((s) => s.key === 'Enter')).toBe(true);
    expect(at(steps[1])).toBe('120,375');
  });
});

describe('the snapping drags in 72', () => {
  const { steps } = bodies[72];
  const moves = steps.filter((s) => s.do === 'touchDrag' && s.steps === 10);
  const arrows = steps.filter((s) => s.do === 'touchDrag' && s.from[0].join(',') === '86,270');
  const toggles = steps.filter((s) => s.role === 'menuitem' && s.name !== 'Preferences');

  it('toggles each snap twice, from an expanded Preferences, closing the menu at (330,300)', () => {
    expect(toggles.map((s) => s.name)).toEqual([
      ...['Snap to objects', 'Snap to objects', 'Snap to midpoints', 'Snap to midpoints'],
    ]);
    for (const [i, step] of steps.entries()) {
      if (step.role !== 'menuitem' || step.name === 'Preferences') continue;
      expect(steps[i - 2]).toMatchObject({ name: 'Preferences', unlessExpanded: true });
      expect(steps[i + 3]).toEqual({ do: 'tap', at: [330, 300] });
    }
  });

  it('drags B up by 17 px, to 3 px below the top of A, before and after Snap to objects', () => {
    const [a, b] = steps.filter((s) => s.do === 'touchDrag' && s.steps === undefined);
    expect([a.from[0][1], b.from[0][1]]).toEqual([120, 140]);
    expect(moves).toHaveLength(2);
    for (const move of moves) {
      expect(move.from[0][0]).toBe(b.from[0][0]);
      expect(move.to[0][1] - move.from[0][1]).toBe(-17);
      expect(b.from[0][1] - 17 - a.from[0][1]).toBe(3);
    }
    const order = steps.filter((s) => s.steps === 10 || toggles.includes(s));
    expect(order.map((s) => s.name ?? 'move').slice(0, 3)).toEqual([
      ...['move', 'Snap to objects', 'move'],
    ]);
  });

  it('ends each arrow 6 px right of and below the midpoint of A bottom stroke', () => {
    const [a] = steps.filter((s) => s.do === 'touchDrag' && s.steps === undefined);
    const midpoint = [(a.from[0][0] + a.to[0][0]) / 2, a.to[0][1]];
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      expect([arrow.to[0][0] - midpoint[0], arrow.to[0][1] - midpoint[1]]).toEqual([6, 6]);
    }
    const order = steps.filter((s) => arrows.includes(s) || s.name === 'Snap to midpoints');
    expect(order.map((s) => s.name ?? 'arrow')).toEqual([
      ...['arrow', 'Snap to midpoints', 'arrow', 'Snap to midpoints'],
    ]);
  });

  it('undoes every move and every arrow right after reading it', () => {
    expect(rolesOf(72).filter((name) => name === 'Undo')).toHaveLength(4);
    for (const [i, step] of steps.entries()) {
      if (step.name !== 'Undo') continue;
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
    }
  });
});

describe('Clear canvas in 73', () => {
  const { steps } = bodies[73];

  it('confirms the dialog after saving it, then presses Undo, reading after each', () => {
    expect(rolesOf(73)).toEqual(['Reset the canvas', 'Confirm', 'Undo']);
    const confirm = steps.findIndex((s) => s.name === 'Confirm');
    expect(steps[confirm - 2]).toEqual({ do: 'aria', save: 'm73-01-confirm' });
    expect(steps[confirm + 2]).toEqual({ do: 'scene', label: '73-cleared' });
    const undo = steps.findIndex((s) => s.name === 'Undo');
    expect(steps[undo + 2]).toEqual({ do: 'scene', label: '73-cleared-undo' });
    expect(steps.findIndex((s) => s.label === '73-before')).toBeLessThan(confirm);
  });
});
