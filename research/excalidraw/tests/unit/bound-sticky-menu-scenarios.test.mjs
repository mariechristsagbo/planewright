// Checks the mobile scenarios 89-92 of the final mobile batch (s83 on): Redo after the Web Embed
// and Bucket fill undos (R-17), the long-press bound between (40,490) and (220,490) (R-09), a
// sticky note with a long self-authored text (R-41) and the canvas-menu toggles, properties and
// view mode (R-08). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const NAMES = {
  89: '89-embed-fill-redo-mobile',
  90: '90-hold-bound-mobile',
  91: '91-sticky-long-text-mobile',
  92: '92-canvas-menu-toggles-mobile',
};
const load = (n) => JSON.parse(readFileSync(join(DIR, `${NAMES[n]}.json`), 'utf8'));
const ALL = Object.keys(NAMES);
const at = (step) => step.at?.join(',');
const roles = (steps) => steps.filter((s) => s.do === 'role').map((s) => s.name);
const READS = new Set(['wait', 'scene', 'appState', 'screenshot', 'aria', 'layout']);
READS.add('assertMetrics');
// The actions after step i: role names and keys, skipping reads.
const actionsAfter = (steps, i) =>
  steps
    .slice(i + 1)
    .filter((s) => !READS.has(s.do))
    .map((s) => (s.do === 'role' ? s.name : `${s.do}:${s.key ?? at(s)}`));

describe('scenarios 89-92', () => {
  it.each(ALL)(
    '%s names only driver steps and asserts the portrait metrics first and last',
    (n) => {
      const body = load(n);
      const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
      for (const step of body.steps) expect(known.has(step.do), step.do).toBe(true);
      expect(body.runLast).toBeUndefined();
      expect(body.continueOnError).toBe(true);
      expect(body.steps[0].do).toBe('assertMetrics');
      expect(body.steps.at(-1)).toEqual(body.steps[0]);
    },
  );

  it.each(ALL)('%s never navigates, reaches the clipboard or a file, or picks a link', (n) => {
    const { steps } = load(n);
    const kinds = steps.map((s) => s.do);
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'selector');
    refused.push('grantClipboard', 'clipboard', 'clipboardItems', 'clipboardUrl', 'clipboardWrite');
    refused.push('wheel', 'drag', 'path', 'url');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const never = ['Add link', 'Copy link to object', 'Insert image', 'Text to diagram AI'];
    never.push('Mermaid to Excalidraw', 'Wireframe to code AI', 'Live collaboration', 'Cut');
    never.push('Copy', 'Paste', 'Background');
    for (const name of never) expect(roles(steps)).not.toContain(name);
    expect(roles(steps).includes('Web Embed')).toBe(n === '89');
    for (const s of steps.filter((t) => t.do === 'click')) expect(s.button).toBe('right');
    expect(kinds.includes('type')).toBe(n === '91');
  });

  it.each(ALL)('%s reads each label once per probe, under its own number', (n) => {
    const { steps } = load(n);
    const reads = steps.filter((s) => s.label).map((s) => `${s.do}:${s.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const s of steps.filter((t) => t.label)) expect(s.label.startsWith(`${n}-`)).toBe(true);
    const saved = steps.filter((s) => s.do === 'aria' || s.do === 'screenshot');
    for (const s of saved) expect(s.save ?? s.name).toMatch(new RegExp(`^m${n}-\\d\\d-`, 'u'));
  });
});

describe('the redos of 89', () => {
  const { steps } = load(89);

  it('drags the empty embed as 80 did, then presses Escape, Undo, Redo and Undo', () => {
    const embed = steps.findIndex((s) => s.name === 'Web Embed');
    expect(steps[embed - 2]).toEqual({ do: 'tap', at: [354, 812] });
    expect(actionsAfter(steps, embed).slice(0, 5)).toEqual([
      'touchDrag:undefined',
      'key:Escape',
      'Undo',
      'Redo',
      'Undo',
    ]);
    const drag = steps.find((s) => s.do === 'touchDrag');
    expect([...drag.from[0], ...drag.to[0]]).toEqual([40, 340, 340, 440]);
  });

  it('fills R once with Bucket fill and presses Undo, Redo and Undo, picking no colour', () => {
    const fill = steps.findIndex((s) => s.name === 'Bucket fill');
    const drags = steps.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
    expect(drags).toEqual([
      [40, 340, 340, 440],
      [60, 340, 300, 430],
    ]);
    expect(actionsAfter(steps, fill)).toEqual([
      'tap:180,385',
      'Undo',
      'Redo',
      'Undo',
      'tap:81,812',
      'Selection',
      'tap:60,362',
      'key:Delete',
      'tap:330,640',
    ]);
  });
});

describe('the hold bound of 90', () => {
  const { steps } = load(90);
  const XS = [40, 70, 100, 130, 160, 190, 220];

  it('holds 800 ms on the left stroke of a new rectangle at each x, 20 px below its corner', () => {
    const holds = steps.filter((s) => s.do === 'touchHold');
    expect(holds.map((s) => [at(s), s.ms])).toEqual(XS.map((x) => [`${String(x)},490`, 800]));
    const drags = steps.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
    expect(drags).toEqual(XS.map((x) => [x, 470, x + 100, 550]));
    for (const [k, hold] of holds.entries()) {
      const i = steps.indexOf(hold);
      expect(steps.indexOf(steps.filter((s) => s.do === 'touchDrag')[k])).toBeLessThan(i);
      expect(steps.slice(i - 2, i)).toEqual([
        { do: 'tap', at: [330, 640] },
        { do: 'wait', ms: 600 },
      ]);
    }
  });

  it('reads the selection, the menu button boxes and the ARIA after each hold, picking nothing', () => {
    expect(roles(steps)).toEqual([]);
    for (const [k, x] of XS.entries()) {
      const i = steps.findIndex((s) => s.do === 'touchHold' && s.at[0] === x);
      expect(steps.slice(i + 1, i + 7)).toEqual([
        { do: 'wait', ms: 700 },
        { do: 'appState', label: `90-hold-${String(x)}` },
        { do: 'layout', label: `90-hold-${String(x)}`, buttons: ['Cut', 'Copy', 'Delete'] },
        { do: 'aria', save: `m90-0${String(k + 1)}-hold-${String(x)}` },
        { do: 'screenshot', name: `m90-0${String(k + 1)}-hold-${String(x)}` },
        { do: 'key', key: 'Escape' },
      ]);
      expect(actionsAfter(steps, i + 6).slice(0, 3)).toEqual([
        'tap:330,640',
        `tap:${String(x)},490`,
        'key:Delete',
      ]);
    }
  });
});

describe('the sticky note of 91 and the canvas menu of 92', () => {
  it('91 types six sentences and one 40-letter word into a note placed at (195,560)', () => {
    const { steps } = load(91);
    const note = steps.findIndex((s) => s.name === 'Sticky note');
    expect(actionsAfter(steps, note)[0]).toBe('tap:195,560');
    const typed = steps.filter((s) => s.do === 'type').map((s) => s.text);
    expect(typed[0]).toBe('Planewright sticky note long text check. '.repeat(6));
    expect(typed[1]).toMatch(/^[A-Za-z]{40}$/u);
    for (const text of typed) expect(text).toMatch(/^[\x20-\x7e]+$/u);
    expect(actionsAfter(steps, steps.indexOf(steps.findLast((s) => s.do === 'type')))).toEqual([
      'key:Escape',
      'touchHold:100,470',
      'Delete',
      'tap:330,640',
    ]);
  });

  it('92 picks each toggle by its exact name from right clicks at (200,180), view mode last', () => {
    const { steps } = load(92);
    expect([...new Set(steps.filter((s) => s.do === 'click').map(at))]).toEqual(['200,180']);
    expect(roles(steps)).toEqual([
      'Snap to objects',
      '✓ Snap to objects',
      '✓ Arrow binding',
      'Arrow binding',
      '✓ Snap to midpoints',
      'Snap to midpoints',
      'Canvas & Shape properties',
      'View mode',
      '✓ View mode',
    ]);
    for (const step of steps.filter((s) => s.do === 'role')) {
      const i = steps.indexOf(step);
      const back = steps.slice(0, i).findLast((s) => !READS.has(s.do));
      expect(back).toEqual({ do: 'click', at: [200, 180], button: 'right' });
      expect(steps[i + 2]).toMatchObject({ do: 'appState' });
    }
    const off = steps.findIndex((s) => s.name === '✓ View mode');
    expect(steps[off - 1]).toEqual({ do: 'aria', save: 'm92-05-view-menu' });
  });
});
