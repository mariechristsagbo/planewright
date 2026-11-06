// Checks which mobile context menu each clipboard item was picked from, from the committed
// scenarios and probes: both Copy to clipboard items only after a long press on a shape (the
// element menu), and Paste only after a right click on empty canvas (the canvas menu). So the
// canvas menu's copies with nothing selected and the element menu's Paste were never picked, and
// the inventory, the residual rows, the backlog, the checkpoint and the readiness record say so.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RE, ROOT, cells, doc, flat, order, probes, read } from './r76-evidence.mjs';

const DIR = 'research/excalidraw/scenarios';
const COPIES = ['Copy to clipboard as PNG', 'Copy to clipboard as SVG'];
const ITEMS = [...COPIES, 'Paste'];
// The first session that ran each scenario with a pick, and its row in the README order table.
const RAN_IN = {
  82: ['s79', 's79-mobile-menu-items-clipboard'],
  88: ['s83', 's83-mobile-final-batch'],
};
const opens = (step) => step.do === 'touchHold' || (step.do === 'click' && step.button === 'right');

// The scene probe read last before a pick: the probe with elements just before the first scene
// label that its scenario reads after the pick.
function sceneBefore(id, steps, n) {
  const next = steps.slice(n).find((s) => s.do === 'scene').label;
  const list = probes(RAN_IN[id][1]);
  return list
    .slice(
      0,
      list.findIndex((p) => p.label === next),
    )
    .findLast((p) => p.elements);
}

// Every pick of a clipboard item in the committed scenarios, with the step that opened its menu
// and whether that point lay on a shape of the scene read before it.
const picks = () =>
  readdirSync(join(ROOT, DIR))
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const id = name.split('-')[0];
      const { steps } = JSON.parse(read(`${DIR}/${name}`));
      return steps.flatMap((step, n) => {
        if (step.do !== 'role' || !ITEMS.includes(step.name)) return [];
        const opener = steps.slice(0, n).findLast(opens);
        const [x, y] = opener.at;
        const onShape = sceneBefore(id, steps, n).elements.some(
          ({ box: [left, top, width, height] }) =>
            x >= left && x <= left + width && y >= top && y <= top + height,
        );
        return [{ id, item: step.name, opener: opener.do, onShape }];
      });
    });
const ids = (list) => [...new Set(list.map((p) => p.id))];

describe('the menu that each mobile clipboard item was picked from', () => {
  it('took both image copies from a long press on a shape and Paste from a right click off one', () => {
    const all = picks();
    expect(ids(all)).toEqual(Object.keys(RAN_IN));
    for (const [id, [short]] of Object.entries(RAN_IN)) expect(order(short)).toContain(id);
    const copies = all.filter((p) => COPIES.includes(p.item));
    expect(copies.map((p) => [p.id, p.item, p.opener, p.onShape])).toEqual(
      COPIES.map((item) => ['82', item, 'touchHold', true]),
    );
    const pastes = all.filter((p) => p.item === 'Paste');
    expect(pastes.length).toBe(3);
    for (const p of pastes) expect([p.opener, p.onShape], p.id).toEqual(['click', false]);
    // A long press on empty canvas opens no menu, so no copy came from the canvas menu.
    expect(cells('R-08')[6]).toContain('a long press there opens nothing');
  });
});

describe('the records of the two unpicked cases', () => {
  it('name them in R-08, R-09 and R-53 and in the inventory, the backlog and the checkpoint', () => {
    const all = picks();
    const copies = ids(all.filter((p) => COPIES.includes(p.item))).join(', ');
    const pastes = ids(all.filter((p) => p.item === 'Paste')).join(', ');
    expect(cells('R-08')[6]).not.toContain('every item');
    expect(cells('R-08')[7]).toContain(
      `neither Copy to clipboard item was picked from it, only from the element menu (${copies})`,
    );
    expect(cells('R-08')[8]).toContain(
      'on mobile both Copy to clipboard items with nothing selected',
    );
    expect(cells('R-09')[6]).toContain('the clipboard items but Paste');
    expect(cells('R-09')[7]).toContain(
      `its Paste was never picked, only the canvas menu's (${pastes})`,
    );
    expect(cells('R-53')[8]).toContain(
      "on mobile the element menu's Paste and the canvas menu's image copies",
    );
    const inventory = doc('feature-inventory.md');
    expect(inventory).not.toContain('every item of both mobile context menus has now been picked');
    expect(inventory).toContain(
      `the canvas menu's two Copy to clipboard items, picked only from the element menu (${copies})` +
        `, so a copy with nothing selected is unobserved, and the element menu's Paste, picked ` +
        `only from the canvas menu (${pastes})`,
    );
    expect(doc('backlog.md')).toContain(
      "the canvas menu's image items with nothing selected and the element menu's Paste " +
        '(R-08, R-09, R-53)',
    );
    expect(doc('checkpoint.md')).not.toContain('every mobile item done in s74–s84');
  });

  it('classify them as refinements, not mandatory, in the readiness record', () => {
    const text = flat(read(`${RE}/readiness.md`));
    expect(text).not.toContain('The agreed mobile list is complete');
    expect(text).toContain(
      'the two Copy to clipboard items were never picked with nothing selected, and the element ' +
        "menu's Paste was never picked either. Both are refinements, not mandatory",
    );
    const refinements = text.split('Refinement, not mandatory.')[1].split(' - ')[0];
    expect(refinements).toContain('picked only from the element menu in 82 (R-08, R-53)');
    expect(refinements).toContain('picked only from the canvas menu in 82 and 88 (R-09, R-53)');
    expect(refinements).toContain('they are not mandatory for issue #1');
  });
});
