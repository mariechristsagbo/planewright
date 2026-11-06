// Checks the record of the final mobile batch (s83–s84) against its committed evidence: the loads
// and the gates, the REA windows, the requests, the replay, and the probe facts behind the
// documented items (R-08, R-09, R-17, R-41, R-53), and the readiness section that classifies what
// stays open.
import { describe, expect, it } from 'vitest';

import {
  RE,
  cells,
  differing,
  entry,
  evidence,
  flat,
  order,
  probe,
  read,
} from './r76-evidence.mjs';

const part = (heading) =>
  flat(read(`${RE}/checkpoint.md`).split(`## ${heading}\n`)[1].split(/^## /mu)[0]);
const section = () => part('Final mobile batch (s83–s84)');
const SESSIONS = ['s83-mobile-final-batch', 's84-mobile-final-batch-2'];
const [s83, s84] = SESSIONS;
const index = () => evidence('sessions-s83-s84.json').sessions;
const reference = (origin) => {
  const host = new URL(origin).hostname;
  return host === 'excalidraw.com' || host.endsWith('.excalidraw.com');
};
const others = (name, label) => probe(name, label).elements.slice(1);

describe('the loads, the gates and the windows of the s83–s84 batch', () => {
  it('state one network document per load, no 403, no failed step and the row counts', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { network, steps } of index()) {
      const documents = network.filter((n) => n.type === 'document');
      expect(documents.map((n) => [n.status, n.count, Boolean(n.fromServiceWorker)])).toEqual([
        [200, 1, false],
      ]);
      expect(network.some((n) => [403, 429].includes(n.status))).toBe(false);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
      expect(network.some((n) => n.event === 'request-failed' && reference(n.origin))).toBe(false);
      expect(network.some((n) => new URL(n.origin).hostname.endsWith('.invalid'))).toBe(false);
      expect([steps.total, steps.failed, steps.byKind.assertMetrics]).toEqual([429, 0, 15]);
    }
    expect(section()).toContain('429 rows each, none failed, with 15 metrics assertions each');
    expect(order('s83')).toEqual(['09', '86', '87', '88', '89', '90', '91', '92', '16']);
    expect(order('s84')).toEqual(order('s83'));
  });

  it('state the window leads, the one font request over 89 and none while drawing', () => {
    const windows = evidence('rea-windows-s83-s84.json').windows;
    expect(windows).toHaveLength(14);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = windows.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '0.0',
      '3.3',
    ]);
    for (const w of windows) {
      const kept = w.file.includes('during-89') ? 1 : 0;
      expect([w.network_requests, w.websocket_connections, w.console_events], w.file).toEqual([
        kept,
        0,
        0,
      ]);
      expect(Date.parse(w.driver.last_step_at) <= Date.parse(w.window.end), w.file).toBe(true);
    }
    expect(section()).toContain('14 windows, one over each scenario, armed 0.0–3.3 s before');
    const placed = evidence('netlog-steps-s83-s84.json').sessions;
    const starts = placed.map((s) => s.drawing.request_starts);
    expect(starts.reduce((sum, s) => sum + s.known, 0)).toBe(40);
    expect(starts.every((s) => s.during_drawing === 0 && s.unknown === 0)).toBe(true);
    const drawn = placed.flatMap((s) => Object.values(s.drawing.steps));
    expect(drawn.reduce((sum, n) => sum + n, 0)).toBe(22);
    expect(section()).toContain(
      'none of the 40 request starts fell in one of the 22 drawing steps',
    );
  });

  it('state that s84 repeats s83 in every shared probe label', () => {
    expect(differing(s84, s83)).toEqual({ shared: 53, labels: [] });
    expect(section()).toContain('s84 against s83: 53 shared labels, all identical');
  });
});

describe('the probe facts behind the s83–s84 items', () => {
  it('back the link, the copied link and the plain-text paste of 86–88', () => {
    const link = (label) => others(s83, label)[0].link;
    expect(link('86-link')).toEqual({
      origin: 'https://example.invalid',
      path: '/planewright-r09',
    });
    expect([probe(s83, '86-link-undo').selected, link('86-link-undo')]).toEqual([
      0,
      link('86-link'),
    ]);
    expect(probe(s83, '86-link-redo').selected).toBe(1);
    expect(others(s83, '87-deleted')).toEqual([]);
    const text = others(s83, '88-pasted')[0];
    expect([text.type, text.box, text.font]).toEqual([
      'text',
      [179.7, 389.5, 215, 25],
      [20, 5, 'left'],
    ]);
    expect([others(s83, '88-pasted-undo'), others(s83, '88-pasted-redo')]).toEqual([[], [text]]);
    expect(entry('B-42')).toContain('Copy link to object');
    expect(entry('B-26')).toContain('[179.7,389.5,215,25]');
  });
});

describe('the probe facts behind the s83–s84 redos, note, hold bound and toggles', () => {
  it('back the redos of 89 and the long note of 91', () => {
    expect(others(s83, '89-embed-redo').map((e) => [e.type, e.box])).toEqual([
      ['embeddable', [40, 340, 300, 100]],
    ]);
    const fill = others(s83, '89-fill-redo')[0];
    expect([fill.type, fill.box, fill.points, fill.style[1]]).toEqual([
      'line',
      [82.5, 340, 240, 90],
      21,
      '#b2f2bb',
    ]);
    const note = (label) => others(s83, label).map((e) => [e.box[3], e.font?.[0]]);
    expect(note('91-note')).toEqual([
      [250, undefined],
      [25, 20],
    ]);
    expect(note('91-sentences')).toEqual([
      [292, undefined],
      [240, 16],
    ]);
    expect(note('91-long-word')).toEqual([
      [332, undefined],
      [280, 16],
    ]);
    expect(entry('B-50')).toContain('Redo restored');
    expect(entry('B-08')).toContain('from font size 20 to 16');
  });

  it('back the hold bound of 90 and the toggles of 92', () => {
    for (const x of [40, 70, 100, 130, 160, 190]) {
      const [cut, copy, del] = probe(s83, `90-hold-${String(x)}`).layout.buttons;
      expect([cut.boxes, copy.boxes, del.boxes]).toEqual([
        [[x + 1, 273, 176, 26]],
        [[x + 1, 299, 176, 26]],
        [[x + 1, 799, 176, 26]],
      ]);
    }
    const last = probe(s83, '90-hold-220');
    expect([last.selected, last.layout.buttons.map((b) => b.boxes)]).toEqual([1, [[], [], []]]);
    const modes = (label) => probe(s83, label).modes;
    expect([modes('92-snap-on').snap, modes('92-snap-off').snap]).toEqual([true, false]);
    expect([modes('92-binding-off').binding, modes('92-binding-on').binding]).toEqual([
      false,
      true,
    ]);
    const midpoints = [
      modes('92-midpoints-off').midpointSnap,
      modes('92-midpoints-on').midpointSnap,
    ];
    expect(midpoints).toEqual([false, true]);
    const boxes = (label) => probe(s83, label).layout.buttons.map((b) => b.boxes.length);
    expect([boxes('92-view'), boxes('92-view-off')]).toEqual([
      [0, 0, 0],
      [1, 1, 1],
    ]);
    expect(entry('B-34')).toContain('between x 190 and 220');
    expect(read(`${RE}/limitations.md`)).toContain('between x 190 and 220');
  });
});

describe('the rows and the readiness record after the s83–s84 batch', () => {
  it('move the mobile link, paste, redo and long-text items out of the next steps', () => {
    expect(cells('R-09')[8]).toBe(
      'Light desktop capture; each item with Ctrl+Z after it on desktop',
    );
    expect(cells('R-17')[8]).toBe('Each entry on desktop; an embed with a self-authored link');
    expect(cells('R-41')[7]).not.toContain('long text');
    expect(cells('R-53')[8]).toBe(
      'Each context-menu item on desktop; an external image paste; ' +
        "on mobile the element menu's Paste and the canvas menu's image copies",
    );
    expect(cells('R-08')[8]).toBe(
      "Toggle Arrow binding off from it on desktop and redraw B-04's arrows; " +
        'on mobile both Copy to clipboard items with nothing selected',
    );
  });

  it('classify every partial criterion and name the review as the one mandatory item left', () => {
    const text = flat(read(`${RE}/readiness.md`));
    for (const kind of [
      'Objective limitation: verification page',
      'Objective limitation: headless native file chooser',
      'Excluded by the maintainer for this phase',
      'Refinement, not mandatory',
    ]) {
      expect(text).toContain(kind);
    }
    expect(text).toContain('No feasible mandatory observation remains');
    expect(text).toContain(
      'the one mandatory item left is the single final independent review (R-75)',
    );
    const summary = part('Readiness');
    expect(summary).toContain('(see [Readiness of issue #1](readiness.md))');
    expect(summary).toContain(
      'is classified in readiness.md. No feasible mandatory observation remains',
    );
    expect(summary).toContain('objective limitation of the verification page');
    expect(summary).toContain('objective limitation of headless Chromium');
    expect(summary).toContain('PR #2 stays a Draft and issue #1 stays open');
  });
});
