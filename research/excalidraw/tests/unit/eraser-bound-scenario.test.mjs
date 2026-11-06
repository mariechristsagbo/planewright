// Checks the mobile scenario 66: the eraser on an arrow's end target and on the arrow, each with
// Undo (R-44, R-52). s71 found that Undo and Redo after an erase leave
// the Selection tool active, so 66 picks the Eraser again before every erase. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const NAME = '66-eraser-bound-mobile';
const body = JSON.parse(readFileSync(join(DIR, `${NAME}.json`), 'utf8'));
const steps = body.steps;
const kinds = steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
const ERASER = '172,812';
// The erase actions: one stroke across the end target, one across the arrow.
const erases = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'touchPath');

describe('scenario 66', () => {
  it('names only driver steps, is not runLast and asserts the portrait metrics first and last', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const kind of kinds) expect(known.has(kind), kind).toBe(true);
    expect(body.runLast).toBeUndefined();
    expect(steps[0].do).toBe('assertMetrics');
    expect(steps.at(-1)).toEqual(steps[0]);
    expect(steps[0].expect).toMatchObject({
      orientationType: 'portrait-primary',
      devicePixelRatio: 3,
    });
  });

  it('never navigates, reloads, emulates, types, opens a menu or reaches a file', () => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'wheel');
    refused.push('grantClipboard', 'clipboard', 'selector', 'click', 'move', 'drag', 'path');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const roles = new Set(steps.filter((s) => s.do === 'role').map((s) => `${s.role}:${s.name}`));
    expect(roles).toEqual(new Set(['button:Undo', 'button:Redo']));
    expect(steps.some((s) => at(s) === '28,28')).toBe(false);
    expect(steps.filter((s) => s.do === 'key')).toEqual([{ do: 'key', key: 'Escape' }]);
  });

  it('labels each read once per kind, with its own number', () => {
    const labelled = steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith('66-')).toBe(true);
  });
});

describe('erasing in 66', () => {
  it('picks the Eraser right before every erase, with no Undo or Redo in between', () => {
    expect(erases).toHaveLength(2);
    for (const [, i] of erases) {
      const before = steps.slice(0, i);
      const pick = before.findLastIndex((s) => at(s) === ERASER);
      const press = before.findLastIndex((s) => s.do === 'role');
      expect(pick, String(i)).toBeGreaterThan(press);
    }
  });

  it('crosses the end target at its right edge, then the arrow between the rectangles', () => {
    const [target, arrow] = steps.filter((s) => s.do === 'touchPath').map((s) => s.points);
    const crosses = (points, axis, value) =>
      Math.min(...points.map((p) => p[axis])) < value &&
      Math.max(...points.map((p) => p[axis])) > value;
    expect(crosses(target, 0, 300) && target.every(([, y]) => y > 150 && y < 230)).toBe(true);
    expect(crosses(arrow, 1, 190) && arrow.every(([x]) => x > 120 && x < 220)).toBe(true);
  });

  it('undoes every erase, so the scene ends as 62 left it, reading after each press', () => {
    const presses = steps.filter((s) => s.do === 'role').map((s) => s.name);
    expect(presses).toEqual(['Undo', 'Redo', 'Undo', 'Undo']);
    const net =
      presses.filter((n) => n === 'Undo').length - presses.filter((n) => n === 'Redo').length;
    expect(net).toBe(erases.length);
    for (const [i, step] of steps.entries()) {
      if (step.do !== 'role') continue;
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
    }
  });

  it('presses Escape right after picking the Eraser and reads the tool', () => {
    const escape = kinds.indexOf('key');
    expect(at(steps[escape - 2])).toBe(ERASER);
    expect(steps[escape + 2]).toEqual({ do: 'appState', label: '66-escape' });
  });
});
