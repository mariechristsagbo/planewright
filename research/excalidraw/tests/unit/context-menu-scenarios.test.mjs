// Checks the mobile scenarios 67, 68 and 74: the long press and the right click on empty canvas
// and on a rectangle (R-08, R-09, R-33), and a CSS-scale and a device-scale capture of one view
// (R-71). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const NAMES = {
  67: '67-context-hold-mobile',
  68: '68-context-right-click-mobile',
  74: '74-css-capture-pair-mobile',
};
const bodies = Object.fromEntries(Object.entries(NAMES).map(([n, name]) => [n, load(name)]));
const kindsOf = (n) => bodies[n].steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
// 67's rectangle [120,330,120,90] and the point on its left stroke.
const EDGE = '120,375';
const inRect = ([x, y]) => x > 120 && x < 240 && y > 330 && y < 420;

describe('scenarios 67, 68 and 74', () => {
  it.each(Object.keys(NAMES))(
    '%s names only driver steps and asserts the portrait metrics first and last',
    (n) => {
      const { steps } = bodies[n];
      const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
      for (const kind of kindsOf(n)) expect(known.has(kind), kind).toBe(true);
      expect(bodies[n].runLast).toBeUndefined();
      expect(bodies[n].continueOnError).toBe(true);
      expect(steps[0].do).toBe('assertMetrics');
      expect(steps.at(-1)).toEqual(steps[0]);
      expect(steps[0].expect).toMatchObject({
        orientationType: 'portrait-primary',
        devicePixelRatio: 3,
      });
    },
  );

  it.each(Object.keys(NAMES))(
    '%s never navigates, types, picks a menu item or reaches a file',
    (n) => {
      const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
      refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog');
      refused.push('grantClipboard', 'clipboard', 'selector', 'wheel', 'role', 'drag', 'path');
      for (const kind of refused) expect(kindsOf(n)).not.toContain(kind);
      const labelled = bodies[n].steps.filter((step) => step.label);
      const reads = labelled.map((step) => `${step.do}:${step.label}`);
      expect(new Set(reads).size).toBe(reads.length);
      for (const { label } of labelled) expect(label.startsWith(`${n}-`)).toBe(true);
    },
  );
});

describe('the long press in 67', () => {
  const { steps } = bodies[67];
  const holds = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'touchHold');

  it('holds 800 ms on empty canvas, on the deselected rectangle and on the selected one', () => {
    expect(holds.map(([step]) => [at(step), step.ms])).toEqual([
      ['200,560', 800],
      [EDGE, 800],
      [EDGE, 800],
    ]);
    expect(inRect(steps[holds[0][1]].at)).toBe(false);
    const drawn = steps.find((step) => step.do === 'touchDrag');
    expect(drawn).toMatchObject({ from: [[120, 330]], to: [[240, 420]] });
    expect(kindsOf(67).indexOf('touchDrag')).toBeLessThan(holds[1][1]);
    const select = steps.findLastIndex((s, i) => i < holds[2][1] && s.do === 'tap');
    expect(at(steps[select])).toBe(EDGE);
  });

  it('saves the ARIA and a capture after each hold, then presses Escape', () => {
    for (const [, i] of holds) {
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 700 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['aria', 'screenshot']);
      expect(steps[i + 2].save).toBe(steps[i + 3].name);
      const escape = steps.findIndex((s, k) => k > i && s.do === 'key');
      expect(steps[escape]).toEqual({ do: 'key', key: 'Escape' });
      expect(steps.slice(i + 1, escape).some((s) => s.do === 'touchHold')).toBe(false);
    }
    expect(kindsOf(67)).not.toContain('click');
  });
});

describe('the right click in 68 and the capture pair in 74', () => {
  it('right-clicks empty canvas and the rectangle stroke only, pressing Escape after each', () => {
    const { steps } = bodies[68];
    const clicks = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'click');
    expect(clicks.map(([step]) => [at(step), step.button])).toEqual([
      ['200,560', 'right'],
      [EDGE, 'right'],
    ]);
    for (const [, i] of clicks) {
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['aria', 'screenshot']);
      expect(steps.slice(i).find((s) => s.do === 'key')).toEqual({ do: 'key', key: 'Escape' });
    }
    expect(kindsOf(68)).not.toContain('touchHold');
  });

  it('takes one CSS-scale and one device-scale capture of one view, with no input', () => {
    const { steps } = bodies[74];
    expect(kindsOf(74)).toEqual(['assertMetrics', 'screenshot', 'screenshot', 'assertMetrics']);
    expect(steps[1]).toEqual({ do: 'screenshot', name: 'm74-01-css', cssScale: true });
    expect(steps[2]).toEqual({ do: 'screenshot', name: 'm74-02-device' });
  });
});
