// Checks the mobile scenarios 69 and 70: every drag-made shape with Undo of its creation (R-29),
// and the More tools entries Frame tool, Laser pointer and Sticky note with the Lasso (R-17,
// R-41). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const NAMES = { 69: '69-shape-drags-undo-mobile', 70: '70-more-tools-sticky-lasso-mobile' };
const bodies = Object.fromEntries(Object.entries(NAMES).map(([n, name]) => [n, load(name)]));
const kindsOf = (n) => bodies[n].steps.map((step) => step.do);
const rolesOf = (n) => bodies[n].steps.filter((s) => s.do === 'role').map((s) => s.name);
const at = (step) => step.at?.join(',');
const MORE = '354,812';
const SELECT = '81,812';
const CREATE = new Set(['touchDrag', 'touchPath']);

describe('scenarios 69 and 70', () => {
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
    },
  );

  it.each(Object.keys(NAMES))('%s never navigates, types, uploads or reaches a file', (n) => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'click');
    refused.push('grantClipboard', 'clipboard', 'selector', 'wheel', 'touchHold', 'drag', 'path');
    for (const kind of refused) expect(kindsOf(n)).not.toContain(kind);
    const labelled = bodies[n].steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith(`${n}-`)).toBe(true);
  });

  it.each(Object.keys(NAMES))('%s presses Undo right after reading each new element', (n) => {
    const { steps } = bodies[n];
    for (const [i, step] of steps.entries()) {
      if (step.do !== 'role' || step.name !== 'Undo') continue;
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
      expect([steps[i - 2].do, steps[i - 1].do]).toEqual(['scene', 'appState']);
    }
  });
});

describe('the shapes in 69', () => {
  const { steps } = bodies[69];
  const creations = steps.filter((s) => CREATE.has(s.do));

  it('draws six shapes, picking each choice by name, and undoes every one', () => {
    expect(rolesOf(69)).toEqual([
      ...['Undo', 'Diamond', 'Undo', 'Ellipse', 'Undo', 'Line', 'Undo', 'Arrow', 'Undo'],
      ...['Freedraw', 'Undo', 'Rectangle'],
    ]);
    expect(creations).toHaveLength(6);
    expect(rolesOf(69).filter((name) => name === 'Undo')).toHaveLength(creations.length);
  });

  it('draws every shape through the same box, from (200,480) to (340,600)', () => {
    const ends = creations.map((s) => (s.do === 'touchDrag' ? [...s.from, ...s.to] : s.points));
    for (const points of ends) {
      expect(points[0]).toEqual([200, 480]);
      expect(points.at(-1)).toEqual([340, 600]);
    }
  });

  it('reads the tool before each drawing and the scene 800 ms after it', () => {
    for (const [i, step] of steps.entries()) {
      if (!CREATE.has(step.do)) continue;
      expect(steps[i - 1]).toMatchObject({ do: 'appState' });
      expect(steps[i - 1].label.endsWith('-tool')).toBe(true);
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
    }
  });

  it('picks Rectangle again and then Selection, so later scenarios draw rectangles', () => {
    const last = steps.findLastIndex((s) => s.do === 'role');
    expect(steps[last].name).toBe('Rectangle');
    expect(at(steps[last - 2])).toBe('218,812');
    expect(steps.slice(last).some((s) => at(s) === SELECT)).toBe(true);
  });
});

describe('the More tools entries and the Lasso in 70', () => {
  const { steps } = bodies[70];

  it('picks Frame tool, Laser pointer and Sticky note from More tools, then the Lasso', () => {
    expect(rolesOf(70)).toEqual([
      ...['Frame tool', 'Undo', 'Laser pointer', 'Sticky note', 'Undo', 'Lasso', 'Selection'],
    ]);
    for (const [i, step] of steps.entries()) {
      if (step.do !== 'role' || step.role !== 'menuitem') continue;
      expect(at(steps.findLast((s, k) => k < i && s.do === 'tap'))).toBe(MORE);
    }
    const lasso = steps.findIndex((s) => s.name === 'Lasso');
    expect(at(steps[lasso - 2])).toBe(SELECT);
  });

  it('undoes the frame and the note, and loops the lasso round 67 rectangle', () => {
    const undo = steps.map((s, i) => [s, i]).filter(([s]) => s.name === 'Undo');
    expect(undo.map(([, i]) => steps[i - 1].label)).toEqual(['70-frame', '70-sticky-escape']);
    const loop = steps.filter((s) => s.do === 'touchPath').at(-1).points;
    expect(loop[0]).toEqual(loop.at(-1));
    const xs = loop.map(([x]) => x);
    const ys = loop.map(([, y]) => y);
    expect([Math.min(...xs) < 120, Math.max(...xs) > 240]).toEqual([true, true]);
    expect([Math.min(...ys) < 330, Math.max(...ys) > 420]).toEqual([true, true]);
  });

  it('places the note with one tap and captures the laser stroke twice', () => {
    const tool = steps.findIndex((s) => s.label === '70-sticky-tool');
    expect(steps[tool + 1]).toEqual({ do: 'tap', at: [195, 180] });
    const laser = steps.findIndex((s) => s.do === 'touchPath');
    const shots = steps.slice(laser, laser + 9).filter((s) => s.do === 'screenshot');
    expect(shots.map((s) => s.name)).toEqual(['m70-03-laser', 'm70-04-laser-later']);
  });
});
