// Checks the order of the Tool lock drags in 63, the System theme, Overlap, Arrow binding and wheel
// steps in 64 and the reloads in 65 (R-02, R-26, R-12, R-33, R-19, R-54). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const stepsOf = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')).steps;
const at = (step) => step.at?.join(',');
const index = (steps, pred, from = 0) => steps.findIndex((step, i) => i >= from && pred(step));

const TOGGLES = stepsOf('63-preferences-undo-tool-lock-mobile');
const SYSTEM = stepsOf('64-system-overlap-binding-wheel-mobile');
const MODES = stepsOf('65-modes-reload-mobile');
// 63's rectangles: [x1, y1, x2, y2] of each drag.
const RECTS = TOGGLES.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
const insideRect = ([x, y], [l, t, r, b]) => x > l && x < r && y > t && y < b;

describe('Tool lock in 63', () => {
  it('picks Rectangle once between the two Tool lock choices and drags twice', () => {
    const [lock, unlock] = TOGGLES.map((s, i) => [s, i])
      .filter(([s]) => s.name === 'Tool lock')
      .map(([, i]) => i);
    const between = TOGGLES.slice(lock, unlock);
    expect(between.filter((s) => at(s) === '218,812')).toHaveLength(1);
    expect(between.filter((s) => s.do === 'touchDrag')).toHaveLength(2);
    expect(RECTS).toEqual([
      [40, 560, 120, 640],
      [200, 560, 280, 640],
      [200, 400, 280, 480],
    ]);
  });

  it('reads 800 ms after each locked drag and taps Selection before turning the lock off', () => {
    const lock = index(TOGGLES, (s) => s.name === 'Tool lock');
    const drags = TOGGLES.map((s, i) => [s, i]).filter(
      ([s], i) => s.do === 'touchDrag' && i > lock,
    );
    for (const [, i] of drags) {
      expect(TOGGLES[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect(TOGGLES[i + 2].do).toBe('scene');
      expect(TOGGLES[i + 3].do).toBe('appState');
    }
    const select = index(TOGGLES, (s) => at(s) === '81,812', lock);
    expect(select).toBeGreaterThan(drags.at(-1)[1]);
    expect(index(TOGGLES, (s) => s.name === 'Tool lock', lock + 1)).toBeGreaterThan(select);
  });
});

describe('System theme, Overlap and Arrow binding in 64', () => {
  it('picks System mode under a dark scheme, then emulates light and dark again', () => {
    const schemes = SYSTEM.filter((s) => s.do === 'colorScheme').map((s) => s.value);
    expect(schemes).toEqual(['dark', 'light', 'dark']);
    const system = index(SYSTEM, (s) => s.name === 'System mode');
    expect(system).toBeGreaterThan(index(SYSTEM, (s) => s.do === 'colorScheme'));
    expect(system).toBeLessThan(index(SYSTEM, (s) => s.value === 'light'));
  });

  it('drags one box over part of a rectangle from empty canvas, before and after Overlap', () => {
    const boxes = SYSTEM.filter((s) => s.do === 'touchDrag' && s.from[0][0] === 180);
    expect(boxes).toHaveLength(2);
    expect(boxes[1]).toEqual(boxes[0]);
    const [x1, y1] = boxes[0].from[0];
    const [x2, y2] = boxes[0].to[0];
    for (const rect of RECTS) expect(insideRect([x1, y1], rect)).toBe(false);
    const [l, t, r, b] = RECTS[2];
    expect(x1 < l && y1 < t && x2 > l && x2 < r && y2 > t && y2 < b).toBe(true);
    const overlap = index(SYSTEM, (s) => s.name === 'Overlap');
    expect(SYSTEM.indexOf(boxes[0])).toBeLessThan(overlap);
    expect(SYSTEM.indexOf(boxes[1])).toBeGreaterThan(overlap);
  });

  it('draws one arrow with binding off and one after it is back on, both inside 63 boxes', () => {
    const [off, on] = SYSTEM.map((s, i) => [s, i])
      .filter(([s]) => s.name === 'Arrow binding')
      .map(([, i]) => i);
    const arrows = SYSTEM.map((s, i) => [s, i]).filter(
      ([s]) => s.do === 'touchDrag' && s.from[0][0] === 80,
    );
    expect(arrows.map(([, i]) => i > off && i < on)).toEqual([true, false]);
    expect(arrows[1][1]).toBeGreaterThan(on);
    for (const [step] of arrows) {
      expect(insideRect(step.from[0], RECTS[0]) && insideRect(step.to[0], RECTS[1])).toBe(true);
    }
  });
});

describe('the wheel in 64 and the reloads in 65', () => {
  it('turns the wheel down and up at one point before Mouse and after it, reading each turn', () => {
    const turns = SYSTEM.map((s, i) => [s, i]).filter(([s]) => s.do === 'wheel');
    expect(turns.map(([s]) => [at(s), s.dy])).toEqual([
      ['300,300', 120],
      ['300,300', -120],
      ['300,300', 120],
      ['300,300', -120],
    ]);
    const mouse = index(SYSTEM, (s) => s.name === 'Mouse');
    expect(turns.map(([, i]) => i > mouse)).toEqual([false, false, true, true]);
    for (const [, i] of turns) expect(SYSTEM[i + 2].do).toBe('appState');
  });

  it('turns zen on before the first reload and view mode between the two', () => {
    const reloads = MODES.map((s, i) => [s, i])
      .filter(([s]) => s.do === 'reload')
      .map(([, i]) => i);
    expect(reloads).toHaveLength(2);
    for (const i of reloads) {
      expect(MODES[i + 1]).toEqual({ do: 'wait', ms: 3000 });
      expect(MODES[i + 2].do).toBe('assertMetrics');
    }
    expect(index(MODES, (s) => s.name === 'Zen mode')).toBeLessThan(reloads[0]);
    const view = index(MODES, (s) => s.name === 'View mode');
    expect(view > reloads[0] && view < reloads[1]).toBe(true);
    const input = ['tap', 'touchDrag', 'role'];
    expect(MODES.slice(reloads[1]).some((s) => input.includes(s.do))).toBe(false);
    for (const label of ['65-before-reload', '65-after-reload', '65-view-reloaded']) {
      expect(MODES.filter((s) => s.label === label).map((s) => s.do)).toEqual([
        'scene',
        'appState',
      ]);
    }
  });
});
