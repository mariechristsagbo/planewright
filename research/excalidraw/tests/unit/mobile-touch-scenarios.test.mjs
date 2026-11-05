// Checks the mobile touch-control scenarios (28-30): they name only driver steps, assert the
// portrait metrics first and last, never navigate, emulate or reload, send touch input only to the
// canvas or the bottom toolbar, click only the named buttons that they state, and lay out the
// popover inventory (R-10, R-39, R-49-R-51, R-30), the arrow-binding ladder (R-42) and the
// handle drags (R-36) as their descriptions say. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const INVENTORY = '28-popover-inventory-mobile';
const BINDING = '29-arrow-binding-mobile';
const HANDLES = '30-transform-handles-mobile';
const ALL = [INVENTORY, BINDING, HANDLES];
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
// Selection, Rectangle and Arrow in the bottom toolbar; every other touch stays on the canvas,
// below the top buttons and above the compact property bar.
const TOOLBAR = { '81,812': 'Selection', '218,812': 'Rectangle', '263,812': 'Arrow' };
const CANVAS = { top: 60, bottom: 740, width: 390 };
const BUTTONS = {
  [INVENTORY]: ['Stroke', 'Actions'],
  [BINDING]: ['Undo', 'Redo'],
  [HANDLES]: ['Undo', 'Redo'],
};

const touchPoints = (step) =>
  step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
const isTool = (step, tool) => step.do === 'tap' && TOOLBAR[step.at.join(',')] === tool;
// The one-finger drags of a scenario, each with the toolbar tool tapped last before it.
const drags = (name) => {
  let tool = 'Selection';
  return stepsOf(name).flatMap((step, index) => {
    if (step.do === 'tap' && TOOLBAR[step.at.join(',')]) tool = TOOLBAR[step.at.join(',')];
    if (step.do !== 'touchDrag') return [];
    const drag = { from: step.from[0], to: step.to[0], tool, index };
    if (tool !== 'Selection') tool = 'Selection';
    return [drag];
  });
};
const boxOf = ({ from, to }) => [from[0], from[1], to[0] - from[0], to[1] - from[1]];

describe('the mobile touch-control scenarios', () => {
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

  it.each(ALL)('%s sends touch input only, and clicks only the buttons it names', (name) => {
    const mouseOrKeys = ['click', 'move', 'drag', 'path', 'key', 'keyDown', 'keyUp', 'type'];
    const kinds = stepsOf(name).map((step) => step.do);
    for (const kind of [...mouseOrKeys, 'wheel', 'selector']) expect(kinds).not.toContain(kind);
    const named = stepsOf(name).filter((step) => step.do === 'role');
    for (const step of named) expect(step).toMatchObject({ role: 'button', exact: true });
    expect([...new Set(named.map((step) => step.name))].sort()).toEqual(BUTTONS[name].sort());
  });

  it.each(ALL)('%s touches the canvas between the bars, or a toolbar tool', (name) => {
    for (const step of stepsOf(name)) {
      for (const [x, y] of touchPoints(step)) {
        if (y > CANVAS.bottom) {
          expect(Object.keys(TOOLBAR)).toContain(`${x},${y}`);
          continue;
        }
        expect(x >= 0 && x <= CANVAS.width && y >= CANVAS.top, `${x},${y}`).toBe(true);
      }
    }
  });

  it.each(ALL)('%s gives every probe and every saved capture its own label', (name) => {
    const labels = stepsOf(name).flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : step.save ? [`aria:${step.save}`] : [],
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the popover inventory scenario (R-10, R-39, R-49-R-51, R-30)', () => {
  const steps = stepsOf(INVENTORY);

  it('closes every popover it opens with the same button, after saving its ARIA', () => {
    const roles = steps.flatMap((step, index) => (step.do === 'role' ? [{ step, index }] : []));
    expect(roles).toHaveLength(12);
    for (let i = 0; i < roles.length; i += 2) {
      const [open, close] = [roles[i], roles[i + 1]];
      expect(close.step).toEqual(open.step);
      const between = steps.slice(open.index + 1, close.index).map((step) => step.do);
      expect(between).toEqual(['wait', 'aria', 'screenshot']);
    }
    const opened = roles.filter((_, i) => i % 2 === 0).map(({ step }) => step.nth ?? 'Actions');
    expect(opened).toEqual([0, 1, 'Actions', 'Actions', 1, 1]);
  });

  it('box-selects both rectangles before the second Actions popover', () => {
    const [a, b, box] = drags(INVENTORY);
    expect([a.tool, b.tool, box.tool]).toEqual(['Rectangle', 'Rectangle', 'Selection']);
    const [ax, ay, aw, ah] = boxOf(a);
    const [bx, by, bw, bh] = boxOf(b);
    expect(box.from[0] < Math.min(ax, bx) && box.from[1] < Math.min(ay, by)).toBe(true);
    expect(box.to[0] > Math.max(ax + aw, bx + bw) && box.to[1] > Math.max(ay + ah, by + bh)).toBe(
      true,
    );
    const second = steps.findIndex((step) => step.save === 'm28-05-actions-two');
    expect(second).toBeGreaterThan(box.index);
  });

  it('taps three arrow points with the Arrow tool and then the last point again', () => {
    const arrow = steps.findLastIndex((step) => isTool(step, 'Arrow'));
    const taps = steps.slice(arrow + 1).filter((step) => step.do === 'tap');
    expect(taps.slice(0, 4).map((step) => step.at)).toEqual([
      [60, 560],
      [200, 620],
      [320, 560],
      [320, 560],
    ]);
  });
});

describe('the arrow-binding scenario (R-42)', () => {
  const [p, q, r, centres, move, ...ladder] = drags(BINDING);

  it('draws P, Q and R, joins the centres of P and Q, then moves Q by its top stroke', () => {
    expect([p, q, r].map(boxOf)).toEqual([
      [40, 120, 100, 80],
      [250, 120, 100, 80],
      [250, 260, 100, 260],
    ]);
    expect(centres.tool).toBe('Arrow');
    expect([centres.from, centres.to]).toEqual([
      [90, 160],
      [300, 160],
    ]);
    const undo = stepsOf(BINDING).findIndex((step) => step.name === 'Undo');
    expect(undo).toBeGreaterThan(centres.index);
    expect(undo).toBeLessThan(move.index);
    expect(move.tool).toBe('Selection');
    expect(move.from).toEqual([300, 120]);
    expect(move.to).toEqual([300, 80]);
  });

  it('ends six arrows at stated distances from R, each from empty canvas', () => {
    expect(ladder.map((d) => d.tool)).toEqual(Array(6).fill('Arrow'));
    expect(ladder.map((d) => 250 - d.to[0])).toEqual([-16, 0, 8, 16, 24, 40]);
    for (const d of ladder) {
      expect(d.from).toEqual([40, d.to[1]]);
      // Far from R's top and bottom edges, so its left stroke is the nearest edge.
      expect(d.to[1] - 260 >= 50 && 520 - d.to[1] >= 50).toBe(true);
    }
  });
});

describe('the transform-handle scenario (R-36)', () => {
  const all = drags(HANDLES);

  it('drags one handle of each new rectangle, starting 4 px outside its box', () => {
    const pairs = [0, 2, 4, 6].map((i) => [boxOf(all[i]), all[i + 1]]);
    const starts = pairs.map(([[x, y, w, h], handle]) => {
      expect(handle.tool).toBe('Selection');
      const column = handle.from[0] < x ? 'w' : handle.from[0] > x + w ? 'e' : '';
      const row = handle.from[1] < y ? 'n' : handle.from[1] > y + h ? 's' : '';
      const gap = [x - 4, x + w + 4, x + w / 2].includes(handle.from[0]);
      expect(gap && [y - 4, y + h + 4, y + h / 2].includes(handle.from[1])).toBe(true);
      return row + column;
    });
    expect(starts).toEqual(['se', 'nw', 'e', 'n']);
  });

  it('turns the fifth rectangle from 20 px above its top edge to the right of its centre', () => {
    const [x, y, w, h] = boxOf(all[8]);
    const turn = all[9];
    expect(turn.from).toEqual([x + w / 2, y - 20]);
    expect(turn.to).toEqual([x + w / 2 + 100, y + h / 2]);
    expect(all).toHaveLength(10);
  });
});
