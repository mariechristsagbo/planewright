// Checks the mobile priority-1 scenarios (25-27): they name only driver steps, assert the portrait
// metrics first and last, never navigate, emulate or reload, send touch input only, inside the
// viewport and clear of the bars, and lay out the tap ladder (R-34), the pinch ratios and anchors
// (R-48) and the selection at a zoom other than 1 before 24's reload (R-54). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;

const HIT = '25-hit-testing-mobile';
const PINCH = '26-pinch-ratios-limits-mobile';
const AT_ZOOM = '27-selection-at-zoom-mobile';
const ALL = [HIT, PINCH, AT_ZOOM];
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
// The Rectangle tool in the bottom toolbar; every other touch stays on the canvas, below the top
// buttons and above the compact property bar.
const RECTANGLE_TOOL = [218, 812];
const CANVAS = { top: 60, bottom: 740, width: 390 };

const touchPoints = (step) =>
  step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? [...step.from, ...step.to] : [];
const distance = ([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const midpoint = ([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const pinches = (name) =>
  stepsOf(name).flatMap((step, index) =>
    step.do === 'touchDrag' && step.from.length === 2 ? [{ step, index }] : [],
  );
const ratio = ({ step }) => Math.round((distance(step.to) / distance(step.from)) * 1e6) / 1e6;
// Milliseconds of waiting between two step indexes, and the kinds of the steps after one.
const waitedBetween = (steps, from, to) =>
  steps.slice(from + 1, to).reduce((sum, step) => sum + (step.do === 'wait' ? step.ms : 0), 0);
const kindsAfter = (steps, index) => {
  const next = steps
    .slice(index + 1)
    .findIndex((step) => !['wait', 'scene', 'appState'].includes(step.do));
  return steps.slice(index + 1, next === -1 ? undefined : index + 1 + next);
};

describe('the mobile priority-1 scenarios', () => {
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

  it.each(ALL)('%s sends touch input only, and no mouse or keyboard input', (name) => {
    const mouseOrKeys = ['click', 'move', 'drag', 'path', 'key', 'keyDown', 'keyUp', 'type'];
    const kinds = stepsOf(name).map((step) => step.do);
    for (const kind of [...mouseOrKeys, 'wheel', 'selector']) expect(kinds).not.toContain(kind);
    const named = stepsOf(name).filter((step) => step.do === 'role');
    expect(named.map((step) => step.name)).toEqual(name === HIT ? ['Background', '#a5d8ff'] : []);
  });

  it.each(ALL)('%s touches the canvas between the bars, or the Rectangle tool', (name) => {
    for (const step of stepsOf(name)) {
      for (const [x, y] of touchPoints(step)) {
        if (y > CANVAS.bottom) {
          expect([x, y]).toEqual(RECTANGLE_TOOL);
          continue;
        }
        expect(x >= 0 && x <= CANVAS.width && y >= CANVAS.top, `${x},${y}`).toBe(true);
      }
    }
  });

  it.each(ALL)('%s gives every probe its own label', (name) => {
    const labels = stepsOf(name).flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : [],
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// The rectangles that a scenario draws: each one-finger drag after a Rectangle tool tap.
const drawn = (name) =>
  stepsOf(name).flatMap((step) =>
    step.do === 'touchDrag' && step.from.length === 1
      ? [
          {
            left: step.from[0][0],
            top: step.from[0][1],
            right: step.to[0][0],
            bottom: step.to[0][1],
          },
        ]
      : [],
  );

// The hit-test taps: each tap followed, after its waits, by an appState probe labelled 25-<shape>-.
const hitTaps = () => {
  const steps = stepsOf(HIT);
  return steps.flatMap((step, index) => {
    const probe = kindsAfter(steps, index).find((s) => s.do === 'appState');
    if (step.do !== 'tap' || !probe?.label?.match(/^25-(transparent|filled)-/u)) return [];
    return [{ step, index, shape: probe.label.split('-')[1], label: probe.label }];
  });
};

describe('the hit-testing scenario (R-34)', () => {
  it('draws two rectangles of the same size and fills the second', () => {
    const [open, filled] = drawn(HIT);
    expect(drawn(HIT)).toHaveLength(2);
    expect(open.right - open.left).toBe(filled.right - filled.left);
    expect(open.bottom - open.top).toBe(filled.bottom - filled.top);
    const steps = stepsOf(HIT);
    const swatch = steps.findIndex((step) => step.name === '#a5d8ff');
    const second = steps.indexOf(steps.filter((step) => step.do === 'touchDrag')[1]);
    expect(swatch).toBeGreaterThan(second);
  });

  it('taps both left strokes at the same offsets, outside, on and inside, up to the centre', () => {
    const [open, filled] = drawn(HIT);
    const offsets = (shape, box) =>
      hitTaps()
        .filter((tap) => tap.shape === shape)
        .map(({ step }) => {
          expect(step.at[1]).toBe((box.top + box.bottom) / 2);
          return step.at[0] - box.left;
        });
    const ladder = offsets('transparent', open);
    expect(offsets('filled', filled)).toEqual(ladder);
    expect(ladder).toEqual([-24, -16, -12, -8, -4, -2, 0, 2, 4, 8, 12, 16, 24, 60]);
    expect((open.right - open.left) / 2).toBe(60);
  });

  it('deselects far from both shapes before each tap, and reads the state after it', () => {
    const steps = stepsOf(HIT);
    const boxes = drawn(HIT);
    const clear = ([x, y]) =>
      boxes.every((b) => x > b.right + 60 || y > b.bottom + 60 || y < b.top - 60);
    for (const { step, index } of hitTaps()) {
      const before = steps.slice(0, index).findLastIndex((s) => s.do === 'tap');
      expect(clear(steps[before].at), `${steps[before].at}`).toBe(true);
      expect(distance([steps[before].at, step.at])).toBeGreaterThan(100);
      expect(waitedBetween(steps, before, index)).toBeGreaterThanOrEqual(500);
      const probe = steps.slice(index + 1).findIndex((s) => s.do === 'appState') + index + 1;
      expect(waitedBetween(steps, index, probe)).toBeGreaterThanOrEqual(800);
    }
    expect(hitTaps()).toHaveLength(28);
  });
});

describe('the pinch scenario (R-48)', () => {
  it('keeps each pinch midpoint still and reads the scene and app state after it', () => {
    const steps = stepsOf(PINCH);
    for (const { step, index } of pinches(PINCH)) {
      expect(midpoint(step.to)).toEqual(midpoint(step.from));
      const after = kindsAfter(steps, index);
      expect(after.filter((s) => s.do === 'wait').reduce((sum, s) => sum + s.ms, 0)).toBe(800);
      expect(after.filter((s) => s.do !== 'wait').map((s) => s.do)).toEqual(['scene', 'appState']);
    }
  });

  it('pinches at six distance ratios, none of them the 190/90 of scenario 10', () => {
    expect(pinches(PINCH).map(ratio)).toEqual([
      2, 0.5, 1.5, 0.333333, 0.2, 0.2, 0.2, 5, 5, 5, 5, 5, 5,
    ]);
  });

  it('moves the anchor in both axes, so a midpoint rule can be told from a fixed one', () => {
    const mids = pinches(PINCH).map(({ step }) => midpoint(step.from));
    expect(new Set(mids.map(([x]) => x)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(mids.map(([, y]) => y)).size).toBeGreaterThanOrEqual(3);
  });

  it('drives the zoom below 1/100 and then 10,000 times up, past any limit in between', () => {
    const ratios = pinches(PINCH).map(ratio);
    const lowest = ratios.slice(0, 7).reduce((zoom, r) => zoom * r, 1);
    expect(lowest).toBeLessThanOrEqual(0.01);
    expect(ratios.slice(7).reduce((zoom, r) => zoom * r, 1)).toBeGreaterThanOrEqual(10000);
  });
});

describe('the selection-at-zoom scenario (R-54)', () => {
  it('pinches once, then draws one rectangle, which stays selected for 24 to reload', () => {
    const steps = stepsOf(AT_ZOOM);
    expect(pinches(AT_ZOOM).map(ratio)).toEqual([1.5]);
    const draw = steps.findIndex((step) => step.do === 'touchDrag' && step.from.length === 1);
    expect(draw).toBeGreaterThan(pinches(AT_ZOOM)[0].index);
    const after = steps.slice(draw + 1).map((step) => step.do);
    expect(after).not.toContain('tap');
    expect(after).toEqual(expect.arrayContaining(['scene', 'appState', 'aria', 'screenshot']));
  });

  it('says that it runs after 25 and before 24', () => {
    expect(scenario(AT_ZOOM).description).toMatch(/after 25\b.*before 24\b/su);
  });
});
