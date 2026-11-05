// Checks the mobile popover scenarios (31-33), written from the controls that s22 saved: they name
// only driver steps, assert the portrait metrics first and last, never navigate, emulate or reload,
// send touch input only, click only buttons by an exact name that s22's popovers or toolbar list,
// start every Actions and style change from a fresh selection, and lay out the layer, alignment
// and grouping actions (R-49-R-51), the style controls (R-10, R-39) and the line taps (R-30) as
// their descriptions say. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const ACTIONS = '31-actions-popover-mobile';
const STYLES = '32-style-controls-mobile';
const LINES = '33-multi-point-taps-mobile';
const ALL = [ACTIONS, STYLES, LINES];
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
const TOOLBAR = ['218,812', '263,812'];
// The names s22 saved in its popovers, the bar and the toolbar; Distribute horizontally, Ungroup
// selection and Line are the help dialog's and the desktop's names, which s22 did not list.
const LAYERS = [
  'Bring forward — Ctrl+]',
  'Bring to front — Ctrl+Shift+]',
  'Send backward — Ctrl+[',
  'Send to back — Ctrl+Shift+[',
];
const ALIGN = ['Align left', 'Align top', 'Center vertically', 'Distribute horizontally'];
const BUTTONS = {
  [ACTIONS]: ['Actions', ...LAYERS, ...ALIGN, 'Group selection', 'Ungroup selection'],
  [STYLES]: ['Stroke', 'Background', 'Red — b', 'Yellow — c'],
  [LINES]: ['Line'],
};
const named = (name) => stepsOf(name).filter((step) => step.do === 'role');

describe('the mobile popover scenarios', () => {
  it.each(ALL)('%s names only steps that the driver has', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
  });

  it.each(ALL)('%s asserts the portrait metrics first and last and is not runLast', (name) => {
    const steps = stepsOf(name);
    expect(steps[0]).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(steps.at(-1)).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(scenario(name).runLast).toBeUndefined();
  });

  it.each(ALL)(
    '%s never navigates, reloads, emulates or reaches the clipboard or files',
    (name) => {
      const kinds = stepsOf(name).map((step) => step.do);
      const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'reload', 'download'];
      refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
      for (const kind of refused) expect(kinds).not.toContain(kind);
    },
  );

  it.each(ALL)('%s sends touch input only and clicks buttons by exact name', (name) => {
    const mouseOrKeys = ['click', 'move', 'drag', 'path', 'key', 'keyDown', 'keyUp', 'type'];
    const kinds = stepsOf(name).map((step) => step.do);
    for (const kind of [...mouseOrKeys, 'wheel', 'selector']) expect(kinds).not.toContain(kind);
    for (const step of named(name)) expect(step).toMatchObject({ role: 'button', exact: true });
    const names = named(name)
      .map((step) => step.name)
      .filter((n) => !['Undo', 'Redo'].includes(n));
    expect([...new Set(names)].sort()).toEqual([...BUTTONS[name]].sort());
  });

  it.each(ALL)('%s touches the canvas between the bars, or a toolbar tool', (name) => {
    for (const step of stepsOf(name)) {
      const points =
        step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
      for (const [x, y] of points) {
        if (y > 740) expect(TOOLBAR).toContain(`${x},${y}`);
        else expect(x >= 0 && x <= 390 && y >= 60, `${x},${y}`).toBe(true);
      }
    }
  });

  it.each(ALL)('%s gives every probe and every saved capture its own label', (name) => {
    const labels = stepsOf(name).flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : step.save ? [`aria:${step.save}`] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

const sameAt = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The first step after an index that is neither a wait nor a probe.
const nextInput = (steps, index) =>
  steps.slice(index + 1).find((s) => !['wait', 'scene', 'appState'].includes(s.do));
// The steps between the last deselecting tap before an index and that index.
const sinceDeselect = (steps, index, deselect) => {
  const start = steps
    .slice(0, index)
    .findLastIndex((s) => s.do === 'tap' && sameAt(s.at, deselect));
  return steps.slice(start + 1, index);
};

describe('the Actions popover scenario (R-49-R-51)', () => {
  const steps = stepsOf(ACTIONS);
  const deselect = [350, 600];
  const opens = steps.flatMap((s, i) => (s.name === 'Actions' ? [i] : []));

  it('opens Actions only after a deselecting tap and a fresh selection', () => {
    expect(opens).toHaveLength(11);
    for (const index of opens) {
      const between = sinceDeselect(steps, index, deselect);
      const select = between.filter((s) => ['tap', 'touchDrag'].includes(s.do));
      expect(select, `before step ${String(index)}`).toHaveLength(1);
    }
  });

  it('applies each layer action to A and each alignment to all three, then undoes it', () => {
    const order = named(ACTIONS).map((s) => s.name);
    const applied = order.filter((n) => LAYERS.includes(n) || ALIGN.includes(n));
    expect(applied).toEqual([...LAYERS, ...ALIGN]);
    for (const name of ALIGN) {
      const at = steps.findIndex((s) => s.name === name);
      expect(steps.slice(at + 1).find((s) => s.do === 'role').name).toBe('Undo');
    }
    const drawn = steps.filter((s) => s.do === 'touchDrag' && s.from[0][0] !== 20).slice(0, 3);
    expect(drawn.map((s) => s.from[0])).toEqual([
      [40, 120],
      [100, 180],
      [160, 240],
    ]);
  });

  it('groups, taps a member, undoes and redoes the grouping, then ungroups', () => {
    const order = named(ACTIONS)
      .map((s) => s.name)
      .filter((n) => !LAYERS.includes(n) && !ALIGN.includes(n) && n !== 'Actions');
    expect(order.slice(-4)).toEqual(['Group selection', 'Undo', 'Redo', 'Ungroup selection']);
  });
});

describe('the style-control scenario (R-10, R-39)', () => {
  const steps = stepsOf(STYLES);
  const deselect = [350, 600];
  const opens = steps.flatMap((s, i) =>
    s.do === 'role' && ['Stroke', 'Background'].includes(s.name) ? [i] : [],
  );

  it('opens every popover after a deselecting tap and a tap on the left stroke', () => {
    expect(opens).toHaveLength(11);
    for (const index of opens) {
      const between = sinceDeselect(steps, index, deselect);
      expect(between.filter((s) => s.do === 'tap').map((s) => s.at)).toEqual([[40, 160]]);
    }
  });

  it("touches the unnamed radios at s22's button centres, one control per opening", () => {
    const radios = opens.flatMap((index) => {
      const next = nextInput(steps, index);
      return steps[index].nth === 1 && next.do === 'tap' ? [next.at] : [];
    });
    expect(radios).toEqual([
      [62, 443],
      [141, 443],
      [101, 502],
      [141, 502],
      [62, 561],
      [141, 561],
      [62, 620],
    ]);
  });
});

describe('the line-tap scenario (R-30)', () => {
  const steps = stepsOf(LINES);

  it('taps three points with the Line tool, then double-taps a drawn line and drags its middle', () => {
    const line = steps.findIndex((s) => s.name === 'Line');
    const taps = steps.slice(line + 1).filter((s) => s.do === 'tap');
    expect(taps.slice(0, 3).map((s) => s.at)).toEqual([
      [60, 280],
      [200, 320],
      [320, 280],
    ]);
    const drag = steps.findIndex((s) => s.do === 'touchDrag');
    const [from, to] = [steps[drag].from[0], steps[drag].to[0]];
    const middle = [(from[0] + to[0]) / 2, from[1]];
    const first = steps.indexOf(nextInput(steps, drag));
    const double = steps.slice(first, first + 3);
    expect(double.map((s) => s.do)).toEqual(['tap', 'wait', 'tap']);
    expect(double[0].at).toEqual(middle);
    expect(double[2].at).toEqual(middle);
    const midpoint = steps.findLast((s) => s.do === 'touchDrag');
    expect(midpoint.from[0]).toEqual(middle);
  });
});
