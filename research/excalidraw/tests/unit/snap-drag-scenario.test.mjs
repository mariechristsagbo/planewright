// Checks the mobile scenario 76: the drag effect of Snap to objects, from a point on a stroke that
// is clear of the resize handles, because s74 found that 72's drag from the middle of a stroke
// moved nothing (R-19). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const body = JSON.parse(readFileSync(join(DIR, '76-snap-drag-mobile.json'), 'utf8'));
const { steps } = body;
const kinds = steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
const moves = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'touchDrag');
// 72's rectangles: A [40,120,80,80] and B [200,140,80,80].
const A_TOP = 120;
const B = { x: 200, y: 140, width: 80 };

describe('scenario 76', () => {
  it('names only driver steps, is not runLast and asserts the portrait metrics first and last', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const kind of kinds) expect(known.has(kind), kind).toBe(true);
    expect(body.runLast).toBeUndefined();
    expect(body.continueOnError).toBe(true);
    expect(steps[0].do).toBe('assertMetrics');
    expect(steps.at(-1)).toEqual(steps[0]);
  });

  it('never navigates, types, presses or reaches a file, and labels each read once', () => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'click');
    refused.push('grantClipboard', 'clipboard', 'selector', 'wheel', 'touchHold', 'key', 'path');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const labelled = steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith('76-')).toBe(true);
  });
});

describe('the drags in 76', () => {
  it('starts on B top stroke 20 px from its corner and its middle, after a tap there', () => {
    expect(moves).toHaveLength(2);
    for (const [move, i] of moves) {
      const [x, y] = move.from[0];
      expect(y).toBe(B.y);
      expect([x - B.x, B.x + B.width / 2 - x]).toEqual([20, 20]);
      const tap = steps.findLastIndex((s, k) => k < i && s.do === 'tap');
      expect(at(steps[tap])).toBe(`${String(x)},${String(y)}`);
    }
  });

  it('moves B 17 px up, so its top ends 3 px below the top of A, and reads 800 ms later', () => {
    for (const [move, i] of moves) {
      expect(move.to[0][0]).toBe(move.from[0][0]);
      expect(move.to[0][1] - move.from[0][1]).toBe(-17);
      expect(move.to[0][1] - A_TOP).toBe(3);
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
    }
  });

  it('drags once before and once after turning Snap to objects on, undoing each, then turns it off', () => {
    const marks = steps
      .map((s, i) => [s, i])
      .filter(([s]) => s.do === 'touchDrag' || s.name === 'Snap to objects' || s.name === 'Undo')
      .map(([s]) => s.name ?? 'drag');
    expect(marks).toEqual(['drag', 'Undo', 'Snap to objects', 'drag', 'Undo', 'Snap to objects']);
    for (const [i, step] of steps.entries()) {
      if (step.name !== 'Snap to objects') continue;
      expect(steps[i - 2]).toMatchObject({ name: 'Preferences', unlessExpanded: true });
      expect(steps[i + 3]).toEqual({ do: 'tap', at: [330, 300] });
    }
  });
});
