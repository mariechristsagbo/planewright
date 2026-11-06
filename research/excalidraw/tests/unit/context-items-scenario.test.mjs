// Checks the mobile scenario 75: items of the context menus that s74 found a long press opens,
// Copy styles and Paste styles (R-53), Wrap selection in frame (R-09), Lock with Undo and Redo, a
// tap and the Eraser on the locked shape and unlocking (R-38, R-44), and the canvas menu by a long
// press once the welcome screen is gone (R-08). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const body = JSON.parse(readFileSync(join(DIR, '75-context-items-lock-mobile.json'), 'utf8'));
const { steps } = body;
const kinds = steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
const P = '40,252';
const Q = '220,252';
const CANVAS = '200,560';
const holds = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'touchHold');
// The steps from each hold up to the next one, and the menu item picked in them, if any.
const regions = holds.map(([, i], k) => steps.slice(i, holds[k + 1]?.[1] ?? steps.length));
const picked = regions.map((region) => region.find((s) => s.do === 'role')?.name ?? null);

describe('scenario 75', () => {
  it('names only driver steps, is not runLast and asserts the portrait metrics first and last', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const kind of kinds) expect(known.has(kind), kind).toBe(true);
    expect(body.runLast).toBeUndefined();
    expect(body.continueOnError).toBe(true);
    expect(steps[0].do).toBe('assertMetrics');
    expect(steps.at(-1)).toEqual(steps[0]);
  });

  it('never navigates, types, uses the clipboard or reaches a file', () => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'click');
    refused.push('grantClipboard', 'clipboard', 'selector', 'wheel', 'drag', 'path');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const names = steps.filter((s) => s.do === 'role').map((s) => s.name);
    for (const item of ['Cut', 'Copy', 'Paste', 'Copy to clipboard as PNG', 'Add link']) {
      expect(names).not.toContain(item);
    }
    const labelled = steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith('75-')).toBe(true);
  });
});

describe('the long presses in 75', () => {
  it('holds 800 ms each, on the canvas, P or Q, and picks the planned item', () => {
    expect(holds.map(([step]) => [at(step), step.ms])).toEqual([
      [CANVAS, 800],
      [P, 800],
      [Q, 800],
      [Q, 800],
      [Q, 800],
      [Q, 800],
      [CANVAS, 800],
    ]);
    expect(picked).toEqual([
      ...[null, 'Copy styles', 'Paste styles', 'Wrap selection in frame', 'Lock', 'Unlock'],
      'Unlock all',
    ]);
  });

  it('holds on the canvas only after drawing, so no welcome screen lies under it', () => {
    const firstDraw = kinds.indexOf('touchDrag');
    expect(holds[0][1]).toBeGreaterThan(firstDraw);
    expect(steps.filter((s) => s.do === 'touchDrag').map((s) => [s.from[0], s.to[0]])).toEqual([
      [
        [40, 230],
        [140, 320],
      ],
      [
        [220, 230],
        [320, 320],
      ],
    ]);
  });

  it('saves the ARIA of every menu it does not act on at once, and reads after every item', () => {
    for (const [k, region] of regions.entries()) {
      const item = region.findIndex((s) => s.do === 'role');
      if (picked[k] === null || picked[k].startsWith('Unlock')) {
        expect(region.slice(0, item < 0 ? undefined : item).some((s) => s.do === 'aria')).toBe(
          true,
        );
      }
      if (picked[k] === null) continue;
      expect(region[item + 1]).toEqual({ do: 'wait', ms: 800 });
      expect(region[item + 2].do).toBe('scene');
    }
  });
});

describe('styles, frame and lock in 75', () => {
  const presses = steps.filter((s) => s.do === 'role' && /^(Undo|Redo)$/u.test(s.name));

  it('gives P a background before copying its styles, and undoes and redoes the paste', () => {
    const yellow = steps.findIndex((s) => s.name === 'Yellow — c');
    expect(steps[yellow - 2]).toMatchObject({ do: 'role', name: 'Background' });
    expect(yellow).toBeLessThan(holds[1][1]);
    expect(presses.map((s) => s.name)).toEqual(['Undo', 'Redo', 'Undo', 'Undo', 'Redo']);
  });

  it('taps Q and strokes the Eraser across it while it is locked, then picks Selection', () => {
    const lock = steps.findIndex((s) => s.name === 'Lock');
    const unlock = steps.findIndex((s) => s.name === 'Unlock');
    const stroke = kinds.indexOf('touchPath');
    expect(lock < stroke && stroke < unlock).toBe(true);
    const between = steps
      .slice(lock, stroke)
      .filter((s) => s.do === 'tap')
      .map(at);
    expect(between).toEqual([Q, '172,812']);
    const xs = steps[stroke].points.map(([x]) => x);
    expect(Math.min(...xs) < 220 && Math.max(...xs) > 220).toBe(true);
    expect(steps.slice(stroke, unlock).some((s) => at(s) === '81,812')).toBe(true);
  });
});
