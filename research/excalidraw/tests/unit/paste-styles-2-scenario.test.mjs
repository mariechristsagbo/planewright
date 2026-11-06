// Checks the mobile scenario 78: 77's Copy styles, Paste styles and Delete at 75's geometry
// (R-53, R-09), because in s76 every long press on 77's right-hand rectangle at (220,490) left no
// menu item to pick, while all of 75's presses at y 252 worked. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const body = JSON.parse(readFileSync(join(DIR, '78-paste-styles-delete-mobile.json'), 'utf8'));
const { steps } = body;
const kinds = steps.map((step) => step.do);
const at = (step) => step.at?.join(',');
const P = '40,252';
const Q = '220,252';
const holds = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'touchHold');
const picked = holds.map(([, i]) => steps.slice(i).find((s) => s.do === 'role')?.name);

describe('scenario 78', () => {
  it('names only driver steps, is not runLast and asserts the portrait metrics first and last', () => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const kind of kinds) expect(known.has(kind), kind).toBe(true);
    expect(body.runLast).toBeUndefined();
    expect(body.continueOnError).toBe(true);
    expect(steps[0].do).toBe('assertMetrics');
    expect(steps.at(-1)).toEqual(steps[0]);
  });

  it('never navigates, types, uses a clipboard item or reaches a file', () => {
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'click');
    refused.push('grantClipboard', 'clipboard', 'selector', 'wheel', 'drag', 'path', 'key');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const names = steps.filter((s) => s.do === 'role').map((s) => s.name);
    for (const item of ['Cut', 'Copy', 'Paste', 'Copy to clipboard as PNG', 'Add link']) {
      expect(names).not.toContain(item);
    }
    const labelled = steps.filter((step) => step.label);
    const reads = labelled.map((step) => `${step.do}:${step.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const { label } of labelled) expect(label.startsWith('78-')).toBe(true);
  });
});

describe('the styles and deletions in 78', () => {
  it('draws both shapes before it gives only P2 a background, chosen after a tap on P2', () => {
    const drags = steps.map((s, i) => [s, i]).filter(([s]) => s.do === 'touchDrag');
    expect(drags.map(([s]) => [s.from[0], s.to[0]])).toEqual([
      [
        [40, 230],
        [140, 320],
      ],
      [
        [220, 230],
        [320, 320],
      ],
    ]);
    const background = steps.findIndex((s) => s.name === 'Background');
    expect(drags.every(([, i]) => i < background)).toBe(true);
    expect(at(steps.findLast((s, k) => k < background && s.do === 'tap'))).toBe(P);
    expect(steps[background + 2]).toMatchObject({ name: 'Yellow — c' });
    expect(background).toBeLessThan(holds[0][1]);
  });

  it('holds 800 ms at the height where 75 pressed and picks the planned item each time', () => {
    expect(holds.map(([s]) => [at(s), s.ms])).toEqual([
      [P, 800],
      [Q, 800],
      [Q, 800],
      [Q, 800],
      [P, 800],
    ]);
    expect(picked).toEqual(['Copy styles', 'Paste styles', 'Delete', 'Delete', 'Delete']);
    for (const [step] of holds) {
      const y = step.at[1];
      expect([y - 230, 275 - y]).toEqual([22, 23]);
    }
  });

  it('undoes and redoes the paste, undoes the first Delete, and reads after every press', () => {
    const presses = steps.filter((s) => s.do === 'role' && /^(Undo|Redo)$/u.test(s.name));
    expect(presses.map((s) => s.name)).toEqual(['Undo', 'Redo', 'Undo']);
    for (const [i, step] of steps.entries()) {
      if (step.do !== 'role' || step.role !== 'button' || step.name === 'Background') continue;
      if (step.name === 'Yellow — c') continue;
      expect(steps[i + 1]).toEqual({ do: 'wait', ms: 800 });
      expect([steps[i + 2].do, steps[i + 3].do]).toEqual(['scene', 'appState']);
    }
    expect(steps.at(-3)).toEqual({ do: 'scene', label: '78-end' });
  });
});
