// Checks the mobile scenarios 79-81 of the menu-items, tools and clipboard batch (s79 on): the
// Flip, Duplicate and Add to library items of the element menu with Undo, Toggle grid and Select
// all from the canvas menu (R-09, R-08), Web Embed, Draw to shape and Bucket fill (R-17), and a
// sticky note with typed text, resized (R-41). No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const NAMES = {
  79: '79-element-menu-flip-duplicate-mobile',
  80: '80-more-tools-embed-shape-fill-mobile',
  81: '81-sticky-text-resize-mobile',
};
const load = (n) => JSON.parse(readFileSync(join(DIR, `${NAMES[n]}.json`), 'utf8'));
const ALL = Object.keys(NAMES);
const at = (step) => step.at?.join(',');
const firstRole = (list) => list.find((s) => s.do === 'role');
const roles = (steps) => steps.filter((s) => s.do === 'role').map((s) => s.name);
// The item each long press picks: the first role step after the hold.
const heldItems = (steps) =>
  steps.flatMap((s, i) =>
    s.do === 'touchHold' ? [[at(s), s.ms, steps.slice(i).find((t) => t.do === 'role')?.name]] : [],
  );
// The steps between a picked item and the next role step, by kind.
const between = (steps, i) => {
  const next = steps.findIndex((s, k) => k > i && s.do === 'role');
  return [steps.slice(i + 1, next).map((s) => s.do), steps[next]?.name];
};
const READS = new Set(['wait', 'scene', 'appState', 'screenshot', 'aria']);

describe('scenarios 79-81', () => {
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
    refused.push('grantClipboard', 'clipboard', 'clipboardItems', 'wheel', 'drag', 'path');
    for (const kind of refused) expect(kinds).not.toContain(kind);
    const never = ['Add link', 'Copy link to object', 'Insert image', 'Text to diagram AI'];
    never.push('Mermaid to Excalidraw', 'Wireframe to code AI', 'Live collaboration', 'Cut');
    for (const name of never) expect(roles(steps)).not.toContain(name);
    for (const s of steps.filter((t) => t.do === 'click')) expect(s.button).toBe('right');
    const typed = steps.filter((s) => s.do === 'type').map((s) => s.text);
    expect(typed).toEqual(n === '81' ? ['Planewright note'] : []);
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

describe('the menu items of 79', () => {
  const { steps } = load(79);

  it('draws A and B first, of different sizes, and right-clicks only empty canvas after', () => {
    const drags = steps.filter((s) => s.do === 'touchDrag').map((s) => [...s.from[0], ...s.to[0]]);
    expect(drags).toEqual([
      [40, 230, 100, 320],
      [200, 230, 320, 290],
    ]);
    const lastDrag = steps.findLastIndex((s) => s.do === 'touchDrag');
    const firstMenu = steps.findIndex((s) => s.do === 'click' || s.do === 'touchHold');
    expect(lastDrag).toBeLessThan(firstMenu);
    const clicks = steps.filter((s) => s.do === 'click');
    expect(clicks.map(at)).toEqual(['200,560', '200,560', '200,560']);
    const items = clicks.map((c) => firstRole(steps.slice(steps.indexOf(c))));
    expect(items.map((s) => s.name)).toEqual(['Toggle grid', 'Toggle grid', 'Select all']);
  });

  it('holds on A 22 px below its corner and picks each planned item', () => {
    expect(heldItems(steps)).toEqual([
      ['40,252', 800, 'Flip horizontal'],
      ['40,252', 800, 'Flip vertical'],
      ['40,252', 800, 'Duplicate'],
      ['40,252', 800, 'Add to library'],
    ]);
    expect([252 - 230, 230 + 90 / 2 - 252]).toEqual([22, 23]);
  });

  it('presses Undo straight after each flip and the Duplicate, with only reads between', () => {
    for (const item of ['Flip horizontal', 'Flip vertical', 'Duplicate']) {
      const [kinds, next] = between(
        steps,
        steps.findIndex((s) => s.name === item),
      );
      expect(next, item).toBe('Undo');
      for (const kind of kinds) expect(READS.has(kind), `${item} ${kind}`).toBe(true);
      expect(kinds.slice(0, 3)).toEqual(['wait', 'scene', 'appState']);
    }
  });

  it('opens and closes the Library after Add to library and then presses Undo', () => {
    const add = steps.findIndex((s) => s.name === 'Add to library');
    expect(roles(steps.slice(add))).toEqual(['Add to library', 'Library', 'Close', 'Undo']);
    const library = steps.findIndex((s) => s.name === 'Library');
    expect(steps.slice(library + 1, library + 4).map((s) => s.do)).toEqual([
      'wait',
      'aria',
      'screenshot',
    ]);
  });
});

describe('the More tools entries of 80', () => {
  const { steps } = load(80);
  const entries = steps.filter((s) => s.role === 'menuitem');

  it('picks each entry by name right after opening More tools', () => {
    expect(entries.map((s) => s.name)).toEqual(['Web Embed', 'Draw to shape', 'Bucket fill']);
    for (const entry of entries) {
      const i = steps.indexOf(entry);
      expect(steps.slice(i - 2, i)).toEqual([
        { do: 'tap', at: [354, 812] },
        { do: 'wait', ms: 600 },
      ]);
    }
  });

  it('drags the embed below 79 shapes, types no link and presses Escape, then Undo', () => {
    const embed = steps.indexOf(entries[0]);
    const drag = steps.find((s, k) => k > embed && s.do === 'touchDrag');
    expect([...drag.from[0], ...drag.to[0]]).toEqual([40, 340, 340, 440]);
    const escape = steps.findIndex((s) => s.key === 'Escape');
    expect(escape).toBeGreaterThan(steps.indexOf(drag));
    expect(between(steps, embed)[1]).toBe('Undo');
    expect(roles(steps).filter((name) => name === 'Undo')).toHaveLength(3);
  });

  it('draws one closed loop with Draw to shape and undoes it', () => {
    const paths = steps.filter((s) => s.do === 'touchPath');
    expect(paths).toHaveLength(1);
    const [first, last] = [paths[0].points[0], paths[0].points.at(-1)];
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThanOrEqual(3);
    expect(steps.indexOf(paths[0])).toBeGreaterThan(steps.indexOf(entries[1]));
    expect(between(steps, steps.indexOf(entries[1]))[1]).toBe('Undo');
  });

  it('fills R at its centre before and after asking for Blue, then deletes R by key', () => {
    const fill = steps.indexOf(entries[2]);
    const target = steps.findLast((s, k) => k < fill && s.do === 'touchDrag');
    expect([...target.from[0], ...target.to[0]]).toEqual([60, 340, 300, 430]);
    const taps = steps.filter((s, k) => k > fill && at(s) === '180,385');
    expect(taps).toHaveLength(2);
    const blue = steps.findIndex((s) => s.name === 'Blue — s');
    expect(steps.indexOf(taps[0]) < blue && blue < steps.indexOf(taps[1])).toBe(true);
    expect(between(steps, steps.indexOf(taps[1]) - 1)[1]).toBe('Undo');
    expect(steps.filter((s) => s.do === 'key').map((s) => s.key)).toEqual(['Escape', 'Delete']);
  });
});

describe('the sticky note of 81', () => {
  const { steps } = load(81);
  const place = steps.findIndex((s) => s.do === 'tap' && at(s) === '195,560');

  it('places the note, then types into it before Escape', () => {
    expect(roles(steps)).toEqual(['Sticky note', 'Undo', 'Delete']);
    const type = steps.findIndex((s) => s.do === 'type');
    expect(place).toBeGreaterThan(steps.findIndex((s) => s.name === 'Sticky note'));
    expect(steps.slice(place + 1, type).map((s) => s.do)).toEqual([
      'wait',
      'scene',
      'appState',
      'aria',
    ]);
    const escape = steps.findIndex((s) => s.key === 'Escape');
    expect(type).toBeGreaterThan(-1);
    expect(type).toBeLessThan(escape);
  });

  it('drags the corner handle 4 px outside a 250 px note centred on the tap, then Undo', () => {
    const corner = [195 + 125, 560 + 125];
    const drag = steps.find((s) => s.do === 'touchDrag');
    expect(drag.from[0]).toEqual([corner[0] + 4, corner[1] + 4]);
    expect(drag.to[0]).toEqual([corner[0] + 44, corner[1] + 44]);
    expect(between(steps, steps.indexOf(drag) - 1)[1]).toBe('Undo');
  });

  it('deletes the note by a hold inside it, at least 30 px from each edge', () => {
    expect(heldItems(steps)).toEqual([['100,470', 800, 'Delete']]);
    const [x, y] = steps.find((s) => s.do === 'touchHold').at;
    expect(Math.min(x - 70, 320 - x, y - 435, 685 - y)).toBeGreaterThanOrEqual(30);
  });
});
