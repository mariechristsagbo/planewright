// Checks the mobile scenarios 62-65: the eraser with Undo and Redo (R-44), Preferences toggles and
// a theme change with Undo and Redo and Tool lock (R-19, R-02), the System theme, Overlap, Arrow
// binding and the wheel per input device (R-26, R-12, R-33), and the theme and modes across a
// reload (R-19, R-54). None navigates, emulates metrics, types, goes offline or reaches a file,
// and none is runLast. No browser is started.
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

const ERASER = '62-eraser-undo-mobile';
const TOGGLES = '63-preferences-undo-tool-lock-mobile';
const SYSTEM = '64-system-overlap-binding-wheel-mobile';
const MODES = '65-modes-reload-mobile';
const ALL = [ERASER, TOGGLES, SYSTEM, MODES];
const EMPTY = '330,300';
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
const at = (step) => step.at?.join(',');
const nextRead = (steps, i) => steps.slice(i + 1).find((step) => step.do !== 'wait');
const roleNames = (name) =>
  new Set(
    stepsOf(name)
      .filter((step) => step.do === 'role')
      .map((step) => `${step.role}:${step.name}`),
  );

describe('scenarios 62-65', () => {
  it.each(ALL)('%s names only driver steps and is not runLast', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each(ALL)(
    '%s never navigates, emulates metrics, types, goes offline or reaches a file',
    (name) => {
      const refused = ['goto', 'fixture', 'emulate', 'offline', 'download', 'fileChooser'];
      refused.push('dropFile', 'acceptDialog', 'grantClipboard', 'clipboard', 'selector', 'type');
      refused.push('selectOption', 'click', 'move', 'drag', 'path', 'keyDown', 'keyUp');
      for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
      for (const step of stepsOf(name)) expect(step.role === 'link').toBe(false);
    },
  );

  it.each(ALL)('%s labels each read once per kind, with its own number', (name) => {
    const labelled = stepsOf(name).filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith(`${name.slice(0, 2)}-`)).toBe(true);
  });

  it('keeps reloads to 65, the colour scheme and the wheel to 64 and Escape to 62', () => {
    for (const name of ALL) {
      const kinds = kindsOf(name);
      expect(kinds.includes('reload'), name).toBe(name === MODES);
      expect(kinds.includes('colorScheme'), name).toBe(name === SYSTEM);
      expect(kinds.includes('wheel'), name).toBe(name === SYSTEM);
      expect(kinds.includes('key'), name).toBe(name === ERASER);
    }
    expect(stepsOf(ERASER).filter((step) => step.do === 'key')).toEqual([
      { do: 'key', key: 'Escape' },
    ]);
  });

  it('starts every scenario with the portrait assertion and ends 62-64 with it', () => {
    for (const name of ALL) expect(stepsOf(name)[0]).toEqual(ASSERT);
    for (const name of [ERASER, TOGGLES, SYSTEM]) expect(stepsOf(name).at(-1)).toEqual(ASSERT);
  });
});

describe('menu choices in 63-65', () => {
  // The menu and the expanded Preferences submenu in s11's capture, in CSS pixels.
  const MENU_BOX = [12, 53, 244, 705];
  const SUBMENU_BOX = [151, 491, 378, 836];
  const inside = ([x, y], [l, t, r, b]) => x >= l && x <= r && y >= t && y <= b;

  it('names exactly the controls each scenario needs, by exact name but Dark mode', () => {
    expect(roleNames(ERASER)).toEqual(new Set(['button:Undo', 'button:Redo']));
    const prefs = 'menuitem:Preferences';
    const undo = ['button:Undo', 'button:Redo'];
    expect(roleNames(TOGGLES)).toEqual(
      new Set([...undo, prefs, 'menuitem:Toggle grid', 'radio:Dark mode', 'menuitem:Tool lock']),
    );
    expect(roleNames(SYSTEM)).toEqual(
      new Set([
        'radio:System mode',
        prefs,
        'radio:Overlap',
        'menuitem:Arrow binding',
        'radio:Mouse',
      ]),
    );
    expect(roleNames(MODES)).toEqual(
      new Set([
        'radio:Dark mode',
        prefs,
        'menuitem:Snap to objects',
        'menuitem:Zen mode',
        'menuitem:View mode',
      ]),
    );
    for (const name of ALL) {
      for (const step of stepsOf(name).filter((s) => s.do === 'role')) {
        expect(step.exact, step.name).toBe(step.name !== 'Dark mode');
      }
    }
  });

  it('never collapses Preferences and closes every choice with a tap outside both menus', () => {
    expect(inside([330, 300], MENU_BOX) || inside([330, 300], SUBMENU_BOX)).toBe(false);
    for (const name of [TOGGLES, SYSTEM, MODES]) {
      const steps = stepsOf(name);
      for (const [i, step] of steps.entries()) {
        if (step.name === 'Preferences') expect(step.unlessExpanded).toBe(true);
        if (step.do !== 'role' || ['Preferences', 'Undo', 'Redo'].includes(step.name)) continue;
        const next = steps.slice(i + 1).find((s) => s.do === 'tap' || s.do === 'reload');
        expect(at(next), `${name} ${step.name}`).toBe(EMPTY);
      }
    }
  });
});

describe('Undo and Redo in 62 and 63', () => {
  const presses = (name) =>
    stepsOf(name)
      .map((step, i) => [step, i])
      .filter(([step]) => step.do === 'role' && ['Undo', 'Redo'].includes(step.name));

  it('reads the scene and the app state right after every Undo and Redo', () => {
    expect(presses(ERASER).map(([s]) => s.name)).toEqual(['Undo', 'Redo', 'Undo', 'Redo', 'Undo']);
    expect(presses(TOGGLES).map(([s]) => s.name)).toEqual(['Undo', 'Redo', 'Undo', 'Redo']);
    for (const name of [ERASER, TOGGLES]) {
      const steps = stepsOf(name);
      for (const [step, i] of presses(name)) {
        const read = nextRead(steps, i);
        expect(read.do, `${name} ${step.name} ${String(i)}`).toBe('scene');
        expect(steps[steps.indexOf(read) + 1].do).toBe('appState');
      }
    }
  });

  it('deselects before the grid toggle and sends no input between a choice and its Undo', () => {
    const steps = stepsOf(TOGGLES);
    const first = steps.findIndex((s) => s.name === 'Preferences');
    const deselect = steps.findIndex((s) => at(s) === EMPTY);
    expect(deselect).toBeGreaterThan(steps.findIndex((s) => s.do === 'touchDrag'));
    expect(deselect).toBeLessThan(first);
    for (const choice of ['Toggle grid', 'Dark mode']) {
      const from = steps.findIndex((s) => s.name === choice);
      const undo = steps.findIndex((s, i) => i > from && s.name === 'Undo');
      const input = steps.slice(from + 1, undo).filter((s) => ['tap', 'touchDrag'].includes(s.do));
      expect(input.map(at), choice).toEqual([EMPTY]);
    }
  });
});

describe('eraser strokes in 62', () => {
  const steps = stepsOf(ERASER);
  const boxes = steps.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
  const strokes = steps.filter((s) => s.do === 'touchPath').map((s) => s.points);

  it('draws three rectangles and one arrow, then reads before the Eraser is picked', () => {
    expect(boxes).toEqual([
      [40, 150, 120, 230],
      [220, 150, 300, 230],
      [80, 190, 260, 190],
      [40, 270, 120, 340],
    ]);
    const before = steps.findIndex((s) => s.label === '62-before');
    const eraser = steps.findIndex((s) => at(s) === '172,812');
    expect(before).toBeGreaterThan(-1);
    expect(before).toBeLessThan(eraser);
    expect(steps.findIndex((s) => s.do === 'touchPath')).toBeGreaterThan(eraser);
  });

  it('crosses the free rectangle, the arrow end target and the arrow, each at one edge', () => {
    expect(strokes).toHaveLength(3);
    const [free, target, arrow] = strokes;
    const crosses = (points, axis, value) =>
      Math.min(...points.map((p) => p[axis])) < value &&
      Math.max(...points.map((p) => p[axis])) > value;
    expect(crosses(free, 0, 40) && free.every(([, y]) => y > 270 && y < 340)).toBe(true);
    expect(crosses(target, 0, 300) && target.every(([, y]) => y > 150 && y < 230)).toBe(true);
    expect(crosses(arrow, 1, 190) && arrow.every(([x]) => x > 120 && x < 220)).toBe(true);
    for (const points of strokes) expect(crosses(points, 1, 190) && points !== arrow).toBe(false);
  });
});
