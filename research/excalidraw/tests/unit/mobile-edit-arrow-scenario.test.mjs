// Checks the mobile scenario 48 (R-30): a fourth point added from a midpoint handle in Edit arrow,
// which s54 saw only while editing, and a point deleted from the Actions popover. It names only
// driver steps, asserts the portrait metrics first and last, never navigates, emulates, reloads or
// reaches the clipboard or files, clicks only exact names that s34 and s54 saved, types nothing,
// and presses Undo straight after each change under test. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scenarios',
  '48-edit-arrow-points-mobile.json',
);
const scenario = JSON.parse(readFileSync(FILE, 'utf8'));
const { steps } = scenario;
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
const kinds = steps.map((step) => step.do);
const roles = steps.filter((step) => step.do === 'role');
const READS = new Set(['wait', 'scene', 'appState', 'aria', 'screenshot']);
const nextAction = (index) => steps.slice(index + 1).find((s) => !READS.has(s.do));
const dragFrom = (at) => steps.findIndex((s) => s.do === 'touchDrag' && `${s.from}` === `${at}`);
const named = (name) => steps.flatMap((s, i) => (s.name === name ? [i] : []));

describe('the Edit arrow point scenario (48)', () => {
  it('names only driver steps, asserts the portrait metrics first and last, and is not runLast', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of steps) expect(known.has(step.do), step.do).toBe(true);
    expect(steps[0]).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(steps.at(-1)).toEqual({ do: 'assertMetrics', expect: PORTRAIT });
    expect(scenario.runLast).toBeUndefined();
  });

  it('never navigates, emulates, reaches the clipboard or files, uses the mouse or types', () => {
    const refused = ['emulate', 'colorScheme', 'goto', 'fixture', 'reload', 'download'];
    refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
    refused.push('click', 'move', 'drag', 'path', 'wheel', 'selector', 'key', 'type');
    for (const kind of refused) expect(kinds).not.toContain(kind);
  });

  it('clicks only exact saved names and touches the canvas between the bars or the Arrow tool', () => {
    for (const step of roles) expect(step.exact).toBe(true);
    const names = roles.map((s) => s.name).filter((n) => !['Undo', 'Redo'].includes(n));
    expect([...new Set(names)].sort()).toEqual(['Actions', 'Arrow type', 'Delete', 'Edit arrow']);
    for (const step of steps) {
      const points = step.do === 'tap' ? [step.at] : step.do === 'touchDrag' ? step.from : [];
      for (const [x, y] of points) {
        if (y > 740) expect(`${x},${y}`).toBe('263,812');
        else expect(y >= 60 && x >= 0 && x <= 390, `${x},${y}`).toBe(true);
      }
    }
  });

  it('gives every probe and every saved ARIA snapshot its own label', () => {
    const labels = steps.flatMap((step) =>
      step.label ? [`${step.do}:${step.label}`] : step.save ? [`aria:${step.save}`] : [],
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the order of the point changes in 48', () => {
  it('makes the arrow sharp, adds the third point, then drags the midpoint only in Edit arrow', () => {
    const sharp = steps.findIndex((s) => s.do === 'tap' && `${s.at}` === '70,690');
    expect(steps[sharp - 2].name).toBe('Arrow type');
    expect(sharp).toBeLessThan(dragFrom([180, 200]));
    expect(dragFrom([180, 200])).toBeLessThan(named('Edit arrow')[0]);
    expect(named('Edit arrow')[0]).toBeLessThan(dragFrom([120, 170]));
  });

  it('presses Undo straight after the fourth point and after Delete, and deletes once', () => {
    expect(nextAction(dragFrom([120, 170])).name).toBe('Undo');
    expect(named('Delete')).toHaveLength(1);
    expect(nextAction(named('Delete')[0]).name).toBe('Undo');
  });

  it('taps the new point before Delete, after the Undo and Redo of the fourth point', () => {
    const tapPoint = steps.findIndex((s) => s.do === 'tap' && `${s.at}` === '120,230');
    const [redo] = named('Redo');
    expect(redo).toBeLessThan(tapPoint);
    expect(nextAction(tapPoint).name).toBe('Actions');
    expect(tapPoint).toBeLessThan(named('Delete')[0]);
  });
});
