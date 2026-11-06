// Checks the mobile scenarios 82-84 of the menu-items, tools and clipboard batch (s79 on): the
// clipboard items of the context menus after an explicit grant on the reference origin (R-53),
// two fingers over shapes and the buttons shown once zoomed (R-33, R-04), and one diagnostic long
// press where s76's presses left no menu item to pick (R-09). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const NAMES = {
  82: '82-clipboard-items-mobile',
  83: '83-two-finger-zoom-mobile',
  84: '84-hold-diagnostic-mobile',
};
const file = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const load = (n) => file(NAMES[n]);
const ALL = Object.keys(NAMES);
const at = (step) => step.at?.join(',');
const roles = (steps) => steps.filter((s) => s.do === 'role').map((s) => s.name);
const heldItems = (steps) =>
  steps.flatMap((s, i) =>
    s.do === 'touchHold' ? [[at(s), s.ms, steps.slice(i).find((t) => t.do === 'role')?.name]] : [],
  );
const nextRole = (steps, i) => steps.find((s, k) => k > i && s.do === 'role')?.name;
const CLIPBOARD = new Set(['grantClipboard', 'clipboard', 'clipboardItems']);

describe('scenarios 82-84', () => {
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

  it.each(ALL)('%s never navigates, types or reaches a file, and only 82 the clipboard', (n) => {
    const { steps } = load(n);
    const kinds = steps.map((s) => s.do);
    const refused = ['goto', 'fixture', 'reload', 'emulate', 'colorScheme', 'offline', 'type'];
    refused.push('selectOption', 'download', 'fileChooser', 'dropFile', 'acceptDialog', 'selector');
    refused.push('wheel', 'drag', 'path', 'touchPath');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    expect(kinds.some((kind) => CLIPBOARD.has(kind))).toBe(n === '82');
    for (const name of ['Add link', 'Copy link to object', 'Live collaboration', 'Paste styles']) {
      expect(roles(steps)).not.toContain(name);
    }
    for (const s of steps.filter((t) => t.do === 'click')) expect(s.button).toBe('right');
  });

  it.each(ALL)('%s reads each label once, under its own number', (n) => {
    const { steps } = load(n);
    const reads = steps.filter((s) => s.label).map((s) => `${s.do}:${s.label}`);
    expect(new Set(reads).size).toBe(reads.length);
    for (const s of steps.filter((t) => t.label)) expect(s.label.startsWith(`${n}-`)).toBe(true);
    const saved = steps.filter((s) => s.do === 'aria' || s.do === 'screenshot');
    for (const s of saved) expect(s.save ?? s.name).toMatch(new RegExp(`^m${n}-\\d\\d-`, 'u'));
  });
});

describe('the clipboard items of 82', () => {
  const { steps } = load(82);

  it('grants the clipboard first, to the reference origin only, before any input', () => {
    expect(steps[1]).toEqual({ do: 'grantClipboard' });
    expect(steps.filter((s) => s.do === 'grantClipboard')).toHaveLength(1);
  });

  it('holds on C 22 px below its corner for each clipboard item', () => {
    const drag = steps.find((s) => s.do === 'touchDrag');
    expect([...drag.from[0], ...drag.to[0]]).toEqual([60, 340, 160, 410]);
    expect(heldItems(steps)).toEqual([
      ['60,362', 800, 'Copy'],
      ['60,362', 800, 'Cut'],
      ['60,362', 800, 'Copy to clipboard as PNG'],
      ['60,362', 800, 'Copy to clipboard as SVG'],
    ]);
  });

  it('reads the clipboard after each item, and its items after Copy, PNG and SVG', () => {
    const reads = steps.filter((s) => CLIPBOARD.has(s.do) && s.label);
    expect(reads.map((s) => `${s.do}:${s.label}`)).toEqual([
      'clipboard:82-copy',
      'clipboardItems:82-copy-items',
      'clipboard:82-cut',
      'clipboardItems:82-png',
      'clipboardItems:82-svg',
      'clipboard:82-svg-text',
    ]);
    for (const item of ['Copy', 'Cut', 'Copy to clipboard as PNG', 'Copy to clipboard as SVG']) {
      const i = steps.findIndex((s) => s.name === item);
      const read = steps.findIndex((s, k) => k > i && CLIPBOARD.has(s.do));
      const next = steps.findIndex((s, k) => k > i && s.do === 'role');
      expect(read, item).toBeGreaterThan(i);
      expect(next === -1 || read < next, item).toBe(true);
    }
  });

  it('pastes only from a right click on empty canvas, each time with Undo after it', () => {
    const clicks = steps.filter((s) => s.do === 'click');
    expect(clicks.map(at)).toEqual(['300,380', '300,380']);
    // Right of C [60,340,100,70] and below 79's rectangles, which end at y 320.
    const [x, y] = clicks[0].at;
    expect([x > 60 + 100, y > 230 + 90]).toEqual([true, true]);
    const pastes = steps.flatMap((s, i) => (s.name === 'Paste' ? [i] : []));
    expect(pastes).toHaveLength(2);
    for (const i of pastes) expect(nextRole(steps, i)).toBe('Undo');
    const cut = steps.findIndex((s) => s.name === 'Cut');
    const undos = roles(steps.slice(cut)).filter((name) => name === 'Undo');
    expect(undos).toHaveLength(2);
    expect(steps.filter((s) => s.do === 'key').map((s) => s.key)).toEqual(['Delete']);
  });
});

describe('the two fingers of 83 and the diagnostic hold of 84', () => {
  it('83 moves two fingers together from A and B, then spreads and pinches them back', () => {
    const { steps } = load(83);
    const drags = steps.filter((s) => s.do === 'touchDrag');
    expect(drags.map((s) => s.from.length)).toEqual([2, 2, 2]);
    const [together, spread, back] = drags;
    expect(together.from).toEqual([
      [40, 260],
      [200, 260],
    ]);
    expect(
      together.to.map(([x, y], k) => [x - together.from[k][0], y - together.from[k][1]]),
    ).toEqual([
      [0, 80],
      [0, 80],
    ]);
    const gap = (points) => points[1][0] - points[0][0];
    expect([gap(spread.from), gap(spread.to)]).toEqual([90, 170]);
    expect([back.from, back.to]).toEqual([spread.to, spread.from]);
    expect(steps.some((s) => s.do === 'aria' && s.save === 'm83-02-zoomed')).toBe(true);
    for (const kind of ['tap', 'touchHold', 'role', 'click', 'key']) {
      expect(steps.map((s) => s.do)).not.toContain(kind);
    }
  });

  it('84 draws 77 shapes and holds at 77 points, saving the ARIA, picking no item', () => {
    const { steps } = load(84);
    const shapes = (list) =>
      list.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
    const earlier = file('77-paste-styles-delete-mobile').steps;
    expect(shapes(steps)).toEqual(shapes(earlier));
    const holds = steps.filter((s) => s.do === 'touchHold');
    expect(holds.map((s) => [at(s), s.ms])).toEqual([
      ['40,490', 800],
      ['220,490', 800],
    ]);
    expect(earlier.filter((s) => s.do === 'touchHold').map(at)).toContain('220,490');
    for (const hold of holds) {
      const i = steps.indexOf(hold);
      const kinds = steps.slice(i + 1, i + 5).map((s) => s.do);
      expect(kinds.slice(0, 3)).toEqual(['wait', 'appState', 'aria']);
    }
    expect(roles(steps)).toEqual([]);
    const keys = steps.filter((s) => s.do === 'key').map((s) => s.key);
    expect(keys).toEqual(['Escape', 'Escape', 'Delete', 'Delete']);
  });
});
