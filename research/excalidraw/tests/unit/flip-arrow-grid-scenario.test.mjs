// Checks the mobile scenario 85 (s81 on), which follows s79: there a long press on one of two
// selected rectangles left only that one selected, so Flip changed nothing stored, and the second
// Toggle grid found no item of that name. 85 flips an arrow by a long press and three selected
// shapes by a right click, and turns the grid off by its checked name (R-09, R-08). No browser
// is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const body = JSON.parse(readFileSync(join(DIR, '85-flip-arrow-grid-mobile.json'), 'utf8'));
const { steps } = body;
const kinds = steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
const roles = steps.filter((s) => s.do === 'role').map((s) => s.name);
const firstRole = (list) => list.find((s) => s.do === 'role')?.name;
const after = (step) => firstRole(steps.slice(steps.indexOf(step) + 1));

describe('scenario 85', () => {
  it('names only driver steps, is not runLast and asserts the portrait metrics first and last', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const kind of kinds) expect(known.has(kind), kind).toBe(true);
    expect(body.runLast).toBeUndefined();
    expect(body.continueOnError).toBe(true);
    expect(steps[0].do).toBe('assertMetrics');
    expect(steps.at(-1)).toEqual(steps[0]);
  });

  it('never navigates, types, reaches the clipboard or a file, or picks a link', () => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'selector');
    refused.push('grantClipboard', 'clipboard', 'clipboardItems', 'wheel', 'drag', 'path', 'key');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    for (const name of ['Add link', 'Copy link to object', 'Cut', 'Copy', 'Paste']) {
      expect(roles).not.toContain(name);
    }
    for (const step of steps.filter((s) => s.do === 'click')) expect(step.button).toBe('right');
    const reads = steps.filter((s) => s.label).map((s) => `${s.do}:${s.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const s of steps.filter((t) => t.label)) expect(s.label.startsWith('85-')).toBe(true);
  });
});

describe('the flips and the grid of 85', () => {
  it('draws the arrow first and holds on it a quarter of the way along, clear of its ends', () => {
    const drags = steps.filter((s) => s.do === 'touchDrag');
    expect(drags[0]).toEqual({ do: 'touchDrag', from: [[60, 240]], to: [[200, 320]] });
    expect(after(steps[steps.indexOf(drags[0]) - 3])).toBe('Arrow');
    const holds = steps.filter((s) => s.do === 'touchHold');
    expect(holds.map((s) => [at(s), s.ms, after(s)])).toEqual([
      ['95,260', 800, 'Flip horizontal'],
      ['95,260', 800, 'Flip vertical'],
    ]);
    expect([60 + 140 / 4, 240 + 80 / 4]).toEqual([95, 260]);
  });

  it('presses Undo straight after each flip, with only reads between', () => {
    const flips = steps.filter((s) => s.name?.startsWith('Flip '));
    expect(flips).toHaveLength(3);
    for (const flip of flips) {
      const i = steps.indexOf(flip);
      const next = steps.findIndex((s, k) => k > i && s.do === 'role');
      expect(steps[next].name).toBe('Undo');
      const between = steps.slice(i + 1, next).map((s) => s.do);
      expect(
        between.every((kind) => ['wait', 'scene', 'appState', 'screenshot'].includes(kind)),
      ).toBe(true);
    }
  });

  it('selects all three shapes, then right-clicks a selected one for the third flip', () => {
    const clicks = steps.filter((s) => s.do === 'click');
    expect(clicks.map((s) => [at(s), after(s)])).toEqual([
      ['200,560', 'Select all'],
      ['40,422', 'Flip horizontal'],
      ['200,560', 'Toggle grid'],
      ['200,560', '✓ Toggle grid'],
    ]);
    const shapes = steps.filter((s) => s.do === 'touchDrag').slice(1);
    expect(shapes.map((s) => [...s.from[0], ...s.to[0]])).toEqual([
      [40, 400, 100, 490],
      [200, 400, 320, 460],
    ]);
    expect(steps.indexOf(shapes[1])).toBeLessThan(steps.indexOf(clicks[0]));
    const right = steps.indexOf(clicks[1]);
    expect(steps.slice(right + 1, right + 4).map((s) => s.do)).toEqual([
      'wait',
      'appState',
      'aria',
    ]);
  });

  it('saves the canvas menu ARIA before it picks the checked Toggle grid', () => {
    const checked = steps.findIndex((s) => s.name === '✓ Toggle grid');
    expect(steps[checked - 1]).toEqual({ do: 'aria', save: 'm85-05-canvas-menu-grid' });
    expect(steps[checked + 2]).toEqual({ do: 'appState', label: '85-grid-off' });
    expect(roles.filter((name) => name.includes('Toggle grid'))).toHaveLength(2);
  });
});
