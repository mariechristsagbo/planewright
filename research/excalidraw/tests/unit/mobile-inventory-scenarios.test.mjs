// Checks the second mobile inventory scenario (36): it names only driver steps, asserts the
// portrait metrics first and last, never navigates, emulates, reloads or reaches the clipboard or
// files, sends touch input apart from one self-authored word typed into a new text, clicks only
// buttons named in s22's popovers and toolbar, opens Save to... without touching any of its
// entries, and never asks for Export to Link. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const INVENTORY = '36-popover-inventory-2-mobile';
const PORTRAIT = {
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
};
// Toolbar tools (Selection, Draw, Rectangle, Arrow, Text) and the main menu button.
const CHROME = ['81,812', '127,812', '218,812', '263,812', '309,812', '28,28'];
const steps = stepsOf(INVENTORY);
const kinds = steps.map((step) => step.do);

describe('the second mobile inventory scenario (36)', () => {
  it('names only steps that the driver has', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of steps) expect(known.has(step.do), step.do).toBe(true);
  });

  it('asserts the portrait metrics first and last and is not runLast', () => {
    expect(steps[0]).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(steps.at(-1)).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(scenario(INVENTORY).runLast).toBeUndefined();
  });

  it('never navigates, reloads, emulates or reaches the clipboard or files', () => {
    const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'reload', 'download'];
    refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog', 'url');
    for (const kind of refused) expect(kinds).not.toContain(kind);
  });

  it('sends touch input, and types one word only into a text it has just placed', () => {
    for (const kind of ['click', 'move', 'drag', 'path', 'key', 'keyDown', 'keyUp', 'wheel']) {
      expect(kinds).not.toContain(kind);
    }
    expect(kinds).not.toContain('selector');
    const typed = steps.flatMap((step, i) => (step.do === 'type' ? [i] : []));
    expect(typed).toHaveLength(1);
    expect(steps[typed[0]].text).toBe('Plan');
    const before = steps.slice(0, typed[0]).filter((s) => s.do === 'tap');
    expect(before.slice(-2).map((s) => s.at)).toEqual([
      [309, 812],
      [60, 300],
    ]);
  });

  it('clicks only buttons by exact name, and one main-menu entry, Save to...', () => {
    const named = steps.filter((step) => step.do === 'role');
    const buttons = named.filter((step) => step.role === 'button');
    for (const step of buttons) expect(step.exact).toBe(true);
    expect([...new Set(buttons.map((step) => step.name))].sort()).toEqual(
      ['Blue — s', 'Close', 'Edit arrow', 'Stroke'].sort(),
    );
    const menu = named.filter((step) => step.role !== 'button');
    expect(menu).toEqual([{ do: 'role', role: 'menuitem', name: 'Save to...', exact: true }]);
  });
});

describe('the Save to... dialog and the touch points of scenario 36', () => {
  it('opens Save to... last and leaves it only by its Close button', () => {
    const open = steps.findIndex((step) => step.name === 'Save to...');
    const after = steps.slice(open + 1);
    const inputs = after.filter(
      (s) => !['wait', 'aria', 'screenshot', 'scene', 'appState'].includes(s.do),
    );
    expect(inputs.slice(0, 1)).toEqual([
      { do: 'role', role: 'button', name: 'Close', exact: true },
    ]);
    expect(inputs.slice(1).map((s) => s.do)).toEqual(['assertMetrics']);
    expect(JSON.stringify(steps)).not.toMatch(/Export to Link|Save to disk|Excalidraw\+/u);
  });

  it('touches the canvas between the bars, a toolbar tool or the menu button', () => {
    for (const step of steps) {
      const points =
        step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
      for (const [x, y] of points) {
        if (y > 740 || y < 60) expect(CHROME).toContain(`${x},${y}`);
        else expect(x >= 0 && x <= 390, `${x},${y}`).toBe(true);
      }
    }
  });

  it('gives every probe and every saved capture its own label', () => {
    const labels = steps.flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : step.save ? [`aria:${step.save}`] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
    const shots = steps.filter((s) => s.do === 'screenshot').map((s) => s.name);
    expect(new Set(shots).size).toBe(shots.length);
  });
});
