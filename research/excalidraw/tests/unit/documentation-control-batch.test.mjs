// Checks the record of the mobile control batch (s37–s50) against its committed evidence: the
// sessions, the verification page met in s50, the REA windows, the replays, the handles (R-36),
// the shape choice and alignments (R-24, R-51), the arrow types and Edit arrow (R-30), the colour,
// Duplicate and text controls (R-10, R-11), the inserts (R-63) and the rows that cite them.
import { describe, expect, it } from 'vitest';

import { cells, differing, entry, evidence, field, flat, probe, read } from './r76-evidence.mjs';

const section = () =>
  flat(
    read('docs/reverse-engineering/checkpoint.md')
      .split('## Mobile control batch (s37–s50)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's37-mobile-inventory-2',
  's38-mobile-handles-3',
  's39-mobile-shapes-align',
  's40-mobile-arrow-types',
  's41-mobile-colours',
  's42-mobile-handles-4',
  's43-mobile-shapes-align-2',
  's44-mobile-arrow-types-2',
  's45-mobile-colours-2',
  's46-mobile-text-controls',
  's47-mobile-text-controls-2',
  's48-mobile-mermaid-undo',
  's49-mobile-mermaid-generate',
  's50-mobile-export-link',
];
const [, HANDLES, SHAPES, ARROWS, COLOURS, HANDLES2, SHAPES2, ARROWS2, COLOURS2] = SESSIONS;
const [TEXT, TEXT2, MERMAID, GENERATE, LINK] = SESSIONS.slice(9);
const PAIRS = [
  [HANDLES2, HANDLES],
  [SHAPES2, SHAPES],
  [ARROWS2, ARROWS],
  [COLOURS2, COLOURS],
  [TEXT2, TEXT],
  [GENERATE, MERMAID],
];
const index = () => evidence('sessions-s37-s50.json').sessions;
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
const boxes = (name, label) => probe(name, label).elements.map((e) => e.box);
const last = (name, label) => probe(name, label).elements.at(-1);

describe('the sessions and REA windows of the control batch', () => {
  it('state which steps failed and that every metric held after each load', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    const failed = index().map((s) => s.steps.failed);
    expect(failed).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0]);
    const asserts = index().map((s) => s.steps.byKind.assertMetrics);
    expect(asserts).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 1]);
    for (const { steps } of index().slice(0, 13)) {
      const loaded = steps.metrics.filter((m) => m.canvases.length > 0);
      for (const c of loaded[0].canvases) expect([c.width, c.height]).toEqual([1170, 2532]);
    }
    expect(section()).toContain('no metrics assertion failed (3 in each, 5 in s49)');
    expect(section()).toContain('The only failed steps were the Close steps');
  });

  it('state that s50 met the verification page and stopped before its upload', () => {
    const network = index().find((s) => s.session === LINK).network;
    const documents = network.filter((n) => n.type === 'document').map((n) => n.status);
    expect(documents).toEqual([403, 200]);
    expect(network.some((n) => n.path.startsWith('/.well-known/vercel/security/'))).toBe(true);
    // The challenge request and the error-reporting envelope of every load; no upload request.
    const posts = network.filter((n) => n.method === 'POST').map((n) => `${n.origin}${n.path}`);
    expect(posts).toEqual([
      'https://excalidraw.com/.well-known/vercel/security/request-challenge',
      'https://sentry.io/api/5179260/envelope/',
    ]);
    expect(index().find((s) => s.session === LINK).steps.total).toBe(9);
    expect(section()).toContain('no Export to Link upload happened and no link exists');
    expect(cells('R-56')[6]).toContain('nor did 44 in s50');
  });

  it('state how early the windows armed and what each kept', () => {
    const wins = evidence('rea-windows-s37-s50.json').windows;
    const leads = wins.map((w) => Date.parse(w.driver.first_step_at) - Date.parse(w.window.start));
    expect(wins.map((w) => w.network_requests)).toEqual([
      0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 82, 82, 3,
    ]);
    for (const w of wins) {
      expect(w.allowed_origins).toHaveLength(7);
      expect([w.websocket_connections, w.console_events]).toEqual([0, 0]);
      expect(Date.parse(w.window.end)).toBeGreaterThan(Date.parse(w.driver.last_step_at));
    }
    expect(section()).toContain(
      `armed ${seconds(Math.min(...leads))}–${seconds(Math.max(...leads))} s before its first step`,
    );
    expect(section()).toContain('All 14 windows returned Evidence');
  });

  it('state the replays and that no request started during a touch drag', () => {
    const shared = PAIRS.map(([later, earlier]) => {
      const { shared: count, labels } = differing(later, earlier);
      expect(labels, later).toEqual([]);
      return count;
    });
    expect(shared).toEqual([11, 10, 13, 9, 5, 3]);
    expect(section()).toContain('11, 10, 13, 9, 5 and 3 shared labels for 37–42');
    for (const s of evidence('netlog-steps-s37-s50.json').sessions)
      expect(s.drawing.request_starts.during_drawing).toBe(0);
  });
});

describe('the handle and alignment records (R-36, R-24, R-51)', () => {
  it('states the four resized boxes and the two-element resize', () => {
    expect(['37-sw', '37-ne', '37-w', '37-s'].map((l) => boxes(HANDLES, l).at(-1))).toEqual([
      [20, 100, 140, 110],
      [220, 90, 140, 100],
      [20, 280, 140, 80],
      [220, 290, 120, 110],
    ]);
    expect(boxes(HANDLES, '37-pair-se').slice(-2)).toEqual([
      [40, 460, 120, 72],
      [220, 508, 120, 72],
    ]);
    expect(boxes(HANDLES, '37-pair-se-undo').slice(-2)).toEqual([
      [40, 460, 80, 60],
      [160, 500, 80, 60],
    ]);
    expect(field(entry('B-16'), 'Edge cases')).toContain('[40,460,120,72] and [220,508,120,72]');
    expect(cells('R-36').slice(4, 6)).toEqual(['✅/❌/✅', '🟡']);
  });

  it('states the diamond, the ellipse and the three alignments', () => {
    const shapes = probe(SHAPES, '38-ellipse').elements.map((e) => [e.type, ...e.box]);
    expect(shapes).toEqual([
      ['rectangle', 40, 120, 120, 80],
      ['diamond', 100, 240, 120, 80],
      ['ellipse', 160, 360, 120, 80],
    ]);
    const xs = (label) => boxes(SHAPES, label).map(([x]) => x);
    expect(xs('38-align-right')).toEqual([160, 160, 160]);
    expect(boxes(SHAPES, '38-align-bottom').map(([, y]) => y)).toEqual([360, 360, 360]);
    expect(xs('38-center-horizontally')).toEqual([100, 100, 100]);
    expect(xs('38-center-horizontally-undo')).toEqual([40, 100, 160]);
    expect(cells('R-24').slice(4, 6)).toEqual(['—/—/✅', '✅']);
    expect(cells('R-51')[7]).not.toContain('Align right');
  });
});

describe('the arrow, colour, text and insert records (R-30, R-10, R-11, R-63)', () => {
  it('states what each Arrow type radio stored and the undo of an added point', () => {
    const arrow = (label) => last(ARROWS, label);
    const kinds = ['39-sharp', '39-elbow', '39-elbow-undo', '39-elbow-redo', '39-round'].map(
      (label) => [arrow(label).style[7], Boolean(arrow(label).elbowed)],
    );
    expect(kinds).toEqual([
      [null, false],
      [null, true],
      [null, false],
      [null, true],
      [2, false],
    ]);
    const points = ['39-middle-drag', '39-middle-drag-undo', '39-middle-drag-redo'];
    expect(points.map((label) => arrow(label).points)).toEqual([3, 2, 3]);
    expect(arrow('39-edit-end-drag').box).toEqual([60, 560, 270, 120]);
    expect(probe(ARROWS, '39-end').selected).toBe(1);
    expect(field(entry('B-40'), 'Undo/redo')).toContain(
      '(39-middle-drag-undo, 39-middle-drag-redo)',
    );
  });

  it('states the shade, the hex code, Duplicate and the font change', () => {
    const stroke = (label) => probe(COLOURS, label).elements[0].style[0];
    expect([stroke('40-shade'), stroke('40-hex')]).toEqual(['#a5d8ff', '#123abc']);
    expect(boxes(COLOURS, '40-duplicate')).toEqual([
      [40, 120, 120, 80],
      [50, 130, 120, 80],
    ]);
    expect(boxes(COLOURS, '40-duplicate-undo')).toHaveLength(1);
    const width = (label) => last(TEXT, label).box[2];
    expect(['41-text', '41-nunito', '41-nunito-undo', '41-nunito-redo'].map(width)).toEqual([
      40.5, 40.9, 40.5, 40.9,
    ]);
    expect(cells('R-11')[7]).toContain('One shade and one hex code');
  });

  it('states the Mermaid and generated inserts and their undo', () => {
    const count = (name, label) => probe(name, label).elements.length;
    expect(
      ['42-inserted', '42-inserted-undo', '42-inserted-redo'].map((l) => count(MERMAID, l)),
    ).toEqual([21, 0, 21]);
    expect(
      ['43-before-insert', '43-inserted', '43-inserted-undo'].map((l) => count(GENERATE, l)),
    ).toEqual([21, 41, 21]);
    expect([
      probe(MERMAID, '42-inserted').selected,
      probe(GENERATE, '43-inserted').selected,
    ]).toEqual([11, 12]);
    const generation = index()[12].network.filter(
      (n) => n.origin === 'https://oss-ai.excalidraw.com',
    );
    expect(generation.map((n) => [n.event, n.method, n.count])).toEqual([
      ['request-failed', 'POST', 1],
    ]);
    expect(section()).toContain('one POST');
    expect(cells('R-63').slice(4, 6)).toEqual(['❌/❌/🟡', '🟡']);
  });
});
