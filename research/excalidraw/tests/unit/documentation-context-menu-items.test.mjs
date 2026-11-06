// Checks the behaviours that the context-menu, tools and snap batch (s74–s78) recorded against its
// committed probe summaries: the context-menu items with Lock and the styles (R-09, R-38, R-53),
// the shapes and their Undo (R-29), More tools (R-17, R-41), the palette and Clear canvas (R-07,
// R-13) and the snaps (R-19).
import { describe, expect, it } from 'vitest';

import { cells, entry, field, probe } from './r76-evidence.mjs';

const [S74, S75, S76, S77, S78] = [
  's74-mobile-context-tools',
  's75-mobile-context-items',
  's76-mobile-context-items-2',
  's77-mobile-paste-styles',
  's78-mobile-paste-styles-2',
];
const at = (name, label, x, y) =>
  probe(name, label).elements.find((e) => e.box[0] === x && e.box[1] === y);
const background = (name, label, x, y) => at(name, label, x, y)?.style[1];

describe('the context menus and their items (R-09, R-38, R-53)', () => {
  it('state that a long press selects a shape, and what Lock, Undo, a tap and the Eraser did', () => {
    for (const name of [S74, S75, S76]) {
      expect(probe(name, '67-deselected').selected).toBe(0);
      expect(probe(name, '67-element-hold').selected).toBe(1);
    }
    for (const name of [S75, S76]) {
      expect([at(name, '75-locked', 220, 230).locked, probe(name, '75-locked').selected]).toEqual([
        true,
        0,
      ]);
      expect(at(name, '75-locked-undo', 220, 230).locked).toBe(false);
      expect(at(name, '75-locked-redo', 220, 230).locked).toBe(true);
      expect(probe(name, '75-locked-tap').selected).toBe(0);
      expect(at(name, '75-locked-erase', 220, 230).locked).toBe(true);
      expect(at(name, '75-unlock-element', 220, 230).locked).toBe(false);
      expect(at(name, '75-framed', 204, 214)).toMatchObject({
        type: 'frame',
        box: [204, 214, 132, 122],
      });
    }
    expect(field(entry('B-19'), 'Undo/redo')).toContain('75-locked-redo');
    expect(field(entry('B-29'), 'Edge cases')).toContain('75-locked-erase');
    expect(cells('R-09')[4]).toBe('❌/✅/✅');
    expect(cells('R-38')[4]).toBe('✅/❌/✅');
  });

  it('state that Paste styles changed the background only where it was not already the same', () => {
    for (const name of [S77, S78]) {
      expect(background(name, '78-two', 220, 230)).toBe('transparent');
      expect(background(name, '78-pasted', 220, 230)).toBe('#ffec99');
      expect(background(name, '78-pasted-undo', 220, 230)).toBe('transparent');
      expect(background(name, '78-pasted-redo', 220, 230)).toBe('#ffec99');
      expect(at(name, '78-deleted-q', 220, 230)).toBeUndefined();
      expect(at(name, '78-deleted-q-undo', 220, 230)).toBeDefined();
    }
    expect(background(S75, '75-two', 220, 230)).toBe('#ffec99');
    expect(background(S76, '77-pasted', 220, 470)).toBe('transparent');
    expect(field(entry('B-27'), 'Edge cases')).toContain('(220,490)');
    expect(cells('R-53')[4]).toBe('✅/❌/🟡');
  });
});

describe('the shapes, More tools, the palette and Clear canvas (R-29, R-17, R-41, R-07, R-13)', () => {
  it('state the six shapes, the tool after each and one Undo removing each', () => {
    const types = ['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freedraw'];
    for (const name of [S74, S75, S76]) {
      for (const type of types) {
        const drawn = at(name, `69-${type}`, 200, 480);
        expect([drawn.type, drawn.box], type).toEqual([type, [200, 480, 140, 120]]);
        const read = probe(name, `69-${type}`);
        const kept = type === 'freedraw' ? ['freedraw', 0] : ['selection', 1];
        expect([read.tool, read.selected], type).toEqual(kept);
        expect(at(name, `69-${type}-undo`, 200, 480), type).toBeUndefined();
      }
    }
    expect(field(entry('B-01'), 'Undo/redo')).toContain('69-freedraw-undo');
    expect(cells('R-29')[4]).toBe('✅/🟡/✅');
  });

  it('state the frame, the laser, the note and the lasso', () => {
    for (const name of [S74, S75, S76]) {
      expect(at(name, '70-frame', 40, 460)).toMatchObject({
        type: 'frame',
        box: [40, 460, 140, 180],
      });
      expect(probe(name, '70-laser').elements).toHaveLength(1);
      expect(probe(name, '70-laser').tool).toBe('laser');
      expect(at(name, '70-sticky', 70, 55)).toMatchObject({ type: 'stickynote', bound: ['text'] });
      expect(probe(name, '70-sticky-escape').elements).toHaveLength(2);
      expect(probe(name, '70-sticky-undo').elements).toHaveLength(1);
      expect([probe(name, '70-lasso').tool, probe(name, '70-lasso').selected]).toEqual([
        'lasso',
        1,
      ]);
    }
    expect(field(entry('B-08'), 'Undo/redo')).toContain('70-sticky-undo');
    expect(cells('R-41')[4]).toBe('✅/❌/✅');
  });

  it('state the zoom after each palette command and the cleared scene with its Undo', () => {
    const fit = [S74, S75, S76].map((name) => probe(name, '71-zoom-fit').scroll);
    expect(fit).toEqual([
      [35, 101],
      [15, 101],
      [15, 36],
    ]);
    for (const name of [S74, S75, S76]) {
      expect(probe(name, '71-zoom-selection').zoom).toBe(2.85);
      expect(probe(name, '71-reset-zoom')).toMatchObject({ zoom: 1, scroll: [15, 29] });
      expect(probe(name, '73-cleared')).toMatchObject({ elements: [], scroll: [0, 0] });
      const before = probe(name, '73-before').elements;
      expect(probe(name, '73-cleared-undo').elements).toEqual(before);
    }
    expect(field(entry('B-36'), 'Desktop/mobile')).toContain('(15,36) with six');
    expect(field(entry('B-35'), 'Undo/redo')).toContain('73-cleared-undo');
    expect(cells('R-07')[4]).toBe('✅/❌/✅');
  });
});

describe('what the snaps do (R-19)', () => {
  it('state the drag aligned only with Snap to objects, and the arrow end per midpoint snapping', () => {
    const b = (name, label) => at(name, label, 200, label.includes('free') ? 123 : 120);
    for (const name of [S75, S76, S77, S78]) {
      expect(b(name, '76-moved-free')).toBeDefined();
      expect(b(name, '76-moved-snap')).toBeDefined();
    }
    for (const name of [S74, S75, S76, S77, S78]) {
      expect(at(name, '72-moved-free', 200, 140)).toBeDefined();
      const arrows = (label) => probe(name, label).elements.filter((e) => e.type === 'arrow');
      const [first] = arrows('72-arrow-first');
      const [second] = arrows('72-arrow-second');
      expect([first.box, first.endBound]).toEqual([[86, 270, 5.5, 64], true]);
      expect([second.box, second.endBound]).toEqual([[86, 270, 0, 64], true]);
      expect(probe(name, '72-midpoints-toggled').modes.midpointSnap).toBe(false);
    }
    expect(field(entry('B-37'), 'Edge cases')).toContain('76-moved-snap');
    expect(cells('R-19')[7]).toContain('on desktop Snap to midpoints not toggled');
  });
});
