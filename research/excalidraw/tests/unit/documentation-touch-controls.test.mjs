// Checks the record of the mobile touch-control batch (s22–s36) against its committed evidence:
// the sessions and REA windows, the replays, arrow binding (R-42), the handles (R-36), the layer,
// alignment and grouping actions (R-49–R-51), the style controls (R-10, R-39), the lines (R-30) and
// the rows and entries that cite them.
import { describe, expect, it } from 'vitest';

import { cells, differing, entry, evidence, field, flat, probe, read } from './r76-evidence.mjs';

const section = () =>
  flat(
    read('docs/reverse-engineering/checkpoint.md')
      .split('## Mobile touch-control batch (s22–s36)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's22-mobile-popovers',
  's23-mobile-arrow-binding',
  's24-mobile-handles',
  's25-mobile-actions',
  's26-mobile-styles',
  's27-mobile-line-taps',
  's28-mobile-arrow-binding-2',
  's29-mobile-handles-2',
  's30-mobile-actions-2',
  's31-mobile-styles-2',
  's32-mobile-line-taps-2',
  's33-mobile-distribute',
  's34-mobile-fill-line',
  's35-mobile-distribute-2',
  's36-mobile-fill-line-2',
];
const [INVENTORY, BINDING, HANDLES, ACTIONS, STYLES, LINES] = SESSIONS;
const [, BINDING2, HANDLES2, ACTIONS2, STYLES2, LINES2, DISTRIBUTE, FILL, DISTRIBUTE2, FILL2] =
  SESSIONS.slice(5);
const PAIRS = [
  [BINDING2, BINDING],
  [HANDLES2, HANDLES],
  [ACTIONS2, ACTIONS],
  [STYLES2, STYLES],
  [LINES2, LINES],
  [DISTRIBUTE2, DISTRIBUTE],
  [FILL2, FILL],
];
const index = () => evidence('sessions-s22-s36.json').sessions;
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
const boxes = (name, label) => probe(name, label).elements.map((e) => e.box);

describe('the sessions and REA windows of the touch-control batch', () => {
  it('state that every step ran and every metric held after each load', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { steps } of index()) {
      expect([steps.failed, steps.byKind.assertMetrics]).toEqual([0, 3]);
      const loaded = steps.metrics.filter((m) => m.canvases.length > 0);
      for (const c of loaded[0].canvases) expect([c.width, c.height]).toEqual([1170, 2532]);
    }
    expect(section()).toContain('no step failed and no metrics assertion failed (3 in each)');
  });

  it('state how early the windows armed and that none kept a request', () => {
    const wins = evidence('rea-windows-s22-s36.json').windows;
    expect(wins).toHaveLength(15);
    const leads = wins.map((w) => Date.parse(w.driver.first_step_at) - Date.parse(w.window.start));
    for (const w of wins) {
      expect(w.allowed_origins).toHaveLength(7);
      expect([w.network_requests, w.websocket_connections, w.console_events]).toEqual([0, 0, 0]);
      expect(Date.parse(w.window.end)).toBeGreaterThan(Date.parse(w.driver.last_step_at));
    }
    expect(section()).toContain(
      `armed ${seconds(Math.min(...leads))}–${seconds(Math.max(...leads))} s before its first step`,
    );
    expect(section()).toContain('All 15 windows returned Evidence and kept 0 requests');
  });

  it('state that each second run read every shared probe the same as the first', () => {
    for (const [later, earlier] of PAIRS) {
      const { shared, labels } = differing(later, earlier);
      expect(shared, later).toBeGreaterThan(5);
      expect(labels, later).toEqual([]);
    }
    expect(section()).toContain('every probe of each second run is identical to the first run');
  });

  it('state that no request started during a touch drag', () => {
    for (const s of evidence('netlog-steps-s22-s36.json').sessions)
      expect(s.drawing.request_starts.during_drawing).toBe(0);
    expect(section()).toContain('no request started while a touch drag was the latest step');
  });
});

describe('the arrow-binding record (R-42)', () => {
  const ladder = ['m16', '0', 'p8', 'p16', 'p24', 'p40'];

  it('states which ends bound and where the bound ends were placed', () => {
    const ends = ladder.map((tag) => probe(BINDING, `29-end-${tag}`).elements.at(-1));
    expect(ends.map((a) => a.endBound)).toEqual([true, true, true, false, false, false]);
    expect(ends.map((a) => a.box[0] + a.box[2])).toEqual([266, 244, 244, 234, 226, 210]);
    const centres = probe(BINDING, '29-arrow-centres').elements.at(-1);
    expect([centres.box, centres.startBound, centres.endBound]).toEqual([
      [90, 160, 210, 0],
      true,
      true,
    ]);
    expect(probe(BINDING, '29-arrow-undo').elements).toHaveLength(3);
    expect(probe(BINDING, '29-target-moved').elements.at(-1).box).toEqual([90, 160, 210, 40]);
    expect(field(entry('B-04'), 'Edge cases')).toContain(
      'so the limit lies between 8 and 16 units',
    );
    expect(cells('R-42').slice(4, 6)).toEqual(['✅/❌/✅', '🟡']);
  });
});

describe('the handle, layer, alignment and grouping records (R-36, R-49–R-51)', () => {
  it('states the four resized boxes and the rotation', () => {
    const last = (label) => boxes(HANDLES, label).at(-1);
    expect(['30-se', '30-nw', '30-e', '30-n'].map(last)).toEqual([
      [30, 100, 150, 110],
      [220, 90, 140, 100],
      [30, 280, 160, 80],
      [240, 260, 120, 110],
    ]);
    const angle = (label) => probe(HANDLES, label).elements.at(-1).angle;
    expect(['30-rotate', '30-rotate-undo', '30-rotate-redo'].map(angle)).toEqual([1.6, 0, 1.6]);
    expect(cells('R-36').slice(4, 6)).toEqual(['✅/❌/✅', '🟡']);
  });

  it('states the stored order after each layer action', () => {
    const order = (label) => boxes(ACTIONS, label).map(([x]) => 'ABC'[(x - 40) / 60]);
    const labels = ['31-bring-forward', '31-bring-to-front', '31-send-backward', '31-send-to-back'];
    expect([...labels, '31-layer-undo', '31-layer-redo'].map(order).map((o) => o.join(''))).toEqual(
      ['BAC', 'BCA', 'BAC', 'ABC', 'BAC', 'ABC'],
    );
    expect(cells('R-50').slice(4, 6)).toEqual(['❌/❌/✅', '🟡']);
  });

  it('states the aligned and distributed positions and the grouping undo', () => {
    const xs = (name, label) => boxes(name, label).map(([x]) => x);
    const ys = (name, label) => boxes(name, label).map(([, y]) => y);
    expect(xs(ACTIONS, '31-align-left')).toEqual([40, 40, 40]);
    expect(ys(ACTIONS, '31-align-top')).toEqual([120, 120, 120]);
    expect(ys(ACTIONS, '31-center-vertically')).toEqual([180, 180, 180]);
    expect(xs(DISTRIBUTE, '34-distribute-horizontally')).toEqual([20, 160, 300]);
    expect(ys(DISTRIBUTE, '34-distribute-vertically').slice(3)).toEqual([260, 390, 520]);
    const groups = (label) => probe(DISTRIBUTE, label).elements.map((e) => e.groups);
    expect(groups('34-group-undo')).toEqual([0, 0, 0, 0, 0, 0]);
    expect(probe(DISTRIBUTE, '34-deselect-undo').selected).toBe(3);
    expect(cells('R-51').slice(4, 6)).toEqual(['❌/❌/✅', '🟡']);
    expect(cells('R-49').slice(4, 6)).toEqual(['✅/❌/✅', '🟡']);
  });
});

describe('the style and line records (R-10, R-39, R-30)', () => {
  it('states the styles that the next rectangle inherited', () => {
    const [, next] = probe(STYLES, '32-next-shape').elements;
    expect(next.style).toEqual(['#e03131', '#ffec99', 'solid', 4, 'dotted', 2, 50, null]);
    const fill = (label) => probe(FILL, label).elements[0].style[2];
    expect(['35-fill-hachure', '35-fill-cross-hatch'].map(fill)).toEqual([
      'hachure',
      'cross-hatch',
    ]);
    expect(cells('R-39').slice(4, 6)).toEqual(['✅/❌/✅', '🟡']);
  });

  it('states what a tap and a drag from a line middle made', () => {
    const tapped = probe(LINES, '33-line-taps').elements.at(-1);
    expect([tapped.type, tapped.box, tapped.points]).toEqual(['line', [10, 280, 100, 0], 2]);
    expect(probe(INVENTORY, '28-arrow-taps').elements.at(-1).box).toEqual([10, 560, 100, 0]);
    for (const [name, label] of [
      [LINES, '33-midpoint-drag'],
      [FILL, '35-line-middle-drag'],
    ]) {
      const line = probe(name, label).elements.find((e) => e.type === 'line' && e.points === 3);
      expect(line.box).toEqual([60, 420, 240, 60]);
    }
    expect(cells('R-30').slice(4, 6)).toEqual(['❌/❌/🟡', '🟡']);
    expect(field(entry('B-40'), 'Immediate result')).toContain('with or without the double tap');
  });
});
