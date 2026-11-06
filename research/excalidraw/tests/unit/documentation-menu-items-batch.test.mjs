// Checks the record of the menu items, tools and clipboard batch (s79–s82) against its committed
// evidence: the loads and the strict gate, the REA windows and listener inspections, the requests,
// the replays, and the probe facts behind the documented items (R-04, R-08, R-09, R-17, R-41,
// R-53, R-65).
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

const section = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Menu items, tools and clipboard batch (s79–s82)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's79-mobile-menu-items-clipboard',
  's80-mobile-menu-items-clipboard-2',
  's81-mobile-flip-arrow-grid',
  's82-mobile-flip-arrow-grid-2',
];
const index = () => evidence('sessions-s79-s82.json').sessions;
const reference = (origin) => {
  const host = new URL(origin).hostname;
  return host === 'excalidraw.com' || host.endsWith('.excalidraw.com');
};
const boxes = (name, label) => probe(name, label).elements.map((e) => e.box);

describe('the loads, the strict gate and the windows of the s79–s82 batch', () => {
  it('state one network document per load, no reload, no 403 and the failed steps', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { network } of index()) {
      const documents = network.filter((n) => n.type === 'document');
      expect(documents.map((n) => [n.status, n.count, Boolean(n.fromServiceWorker)])).toEqual([
        [200, 1, false],
      ]);
      expect(network.some((n) => [403, 429].includes(n.status))).toBe(false);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
      const failed = network.filter((n) => n.event === 'request-failed');
      expect(failed.some((n) => reference(n.origin))).toBe(false);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([13, 13, 3, 3]);
    expect(index().map((s) => s.steps.failed)).toEqual([1, 1, 0, 0]);
    expect(index()[0].steps.failures.map((f) => f.step)).toEqual(['role']);
    expect(index().map((s) => s.steps.total)).toEqual([358, 358, 93, 93]);
    expect(section()).toContain('(13 each in s79 and s80, 3 each in s81 and s82)');
    expect(section()).toContain('(358, 358, 93 and 93 rows)');
    expect(order('s79')).toEqual(['09', '79', '80', '81', '84', '82', '83', '16']);
    expect(order('s81')).toEqual(['09', '85', '16']);
  });

  it('state the window leads, the font kept over 80 and no request while drawing', () => {
    const windows = evidence('rea-windows-s79-s82.json').windows;
    expect(windows).toHaveLength(14);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = windows.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '0.4',
      '3.7',
    ]);
    for (const w of windows) {
      const kept = w.file.includes('during-80') ? 1 : 0;
      expect([w.network_requests, w.websocket_connections, w.console_events], w.file).toEqual([
        kept,
        0,
        0,
      ]);
      expect(Date.parse(w.driver.last_step_at) <= Date.parse(w.window.end), w.file).toBe(true);
    }
    expect(section()).toContain('14 windows over scenarios, armed 0.4–3.7 s before');
    const placed = evidence('netlog-steps-s79-s82.json').sessions;
    const starts = placed.map((s) => s.drawing.request_starts);
    expect(starts.reduce((sum, s) => sum + s.known, 0)).toBe(78);
    expect(starts.every((s) => s.during_drawing === 0 && s.unknown === 0)).toBe(true);
    const steps = placed.flatMap((s) => Object.values(s.drawing.steps));
    expect(steps.reduce((sum, n) => sum + n, 0)).toBe(30);
    expect(section()).toContain(
      'none of the 78 request starts fell in one of the 30 drawing steps',
    );
  });
});

describe('the listener inspections and the replays of the s79–s82 batch', () => {
  it('state the six app-root listeners and none on the other three nodes, keeping no source', () => {
    const summary = (key) => evidence(`rea-listeners-s82-${key}.summary.json`);
    const root = summary('app-root');
    expect([root.selector, root.matched]).toEqual(['.excalidraw', true]);
    const types = root.listeners.map((l) => l.type);
    expect(types).toEqual(['dragover', 'dragover', 'drop', 'wheel', 'dragenter', 'dragleave']);
    for (const l of root.listeners) {
      expect([l.use_capture, l.passive, l.once]).toEqual([false, false, false]);
    }
    for (const key of ['static-canvas', 'html', 'body']) {
      expect([summary(key).matched, summary(key).listeners], key).toEqual([true, []]);
    }
    for (const key of ['app-root', 'static-canvas', 'html', 'body']) {
      const text = JSON.stringify(summary(key));
      for (const absent of ['line_number', 'source_map', '"text"', 'script_id']) {
        expect(text.includes(absent), `${key} ${absent}`).toBe(false);
      }
    }
    expect(cells('R-65')[6]).toContain('on the app root two dragover, drop, wheel');
    expect(section()).toContain('none on canvas.static, html or body');
  });

  it('state the shared labels, the two flip labels that differ and the identical 79–84', () => {
    expect(differing(SESSIONS[1], SESSIONS[0])).toEqual({ shared: 54, labels: [] });
    expect(differing(SESSIONS[3], SESSIONS[2])).toEqual({
      shared: 14,
      labels: ['85-flip-h', '85-flip-v'],
    });
    const first = (name) => probe(name, '85-flip-h').elements[0].box[0];
    expect(Math.abs(first(SESSIONS[2]) - first(SESSIONS[3]))).toBeLessThanOrEqual(0.9);
    expect(section()).toContain('s80 against s79: 54 shared labels, all identical');
    expect(section()).toContain('s82 against s81: 14 shared labels, 12 identical');
  });
});

describe('the probe facts behind the s79–s82 items', () => {
  const [s79, , s81] = SESSIONS;

  it('back the element-menu, flip and grid facts of 79 and 85', () => {
    expect(probe(s79, '79-select-all').selected).toBe(2);
    expect(probe(s79, '79-hold').selected).toBe(1);
    expect(boxes(s79, '79-flip-h')).toEqual(boxes(s79, '79-two'));
    expect(boxes(s79, '79-duplicate')).toContainEqual([50, 240, 60, 90]);
    expect(probe(s79, '79-grid-off').modes.grid).toBe(true);
    expect(boxes(s81, '85-flip-all')).toEqual([
      [300, 240, 140, 80],
      [260, 400, 60, 90],
      [40, 400, 120, 60],
    ]);
    expect(probe(s81, '85-right-selected').selected).toBe(3);
    expect(probe(s81, '85-grid-off').modes.grid).toBe(false);
    expect(cells('R-09')[8]).toBe(
      'Light desktop capture; each item with Ctrl+Z after it on desktop; Add link and Copy link to object on mobile',
    );
  });

  it('back the More tools, sticky note and two-finger facts of 80, 81 and 83', () => {
    const fill = probe(s79, '80-fill-first').elements.find((e) => e.type === 'line');
    expect([fill.points, fill.style[0], fill.style[1]]).toEqual([21, 'transparent', '#b2f2bb']);
    expect(probe(s79, '80-embed').elements.at(-1).type).toBe('embeddable');
    expect(probe(s79, '80-shape-tool').tool).toBe('autoshape');
    const note = probe(s79, '81-resized').elements.filter((e) => e.type !== 'rectangle');
    expect(note.map((e) => e.box[2])).toEqual([300, 197.3]);
    expect(note[1].font[0]).toBe(24);
    expect([probe(s79, '83-two-finger').selected, probe(s79, '83-two-finger').scroll]).toEqual([
      0,
      [0, 80],
    ]);
    expect(probe(s79, '83-spread').zoom).toBeCloseTo(170 / 90, 5);
    expect(entry('B-50')).toContain('Web Embed and Bucket fill\n\n- **Initial state:**');
    expect(cells('R-04')[4]).toBe('🟡/❌/✅');
    expect(cells('R-52').join(' ')).toContain('B-50 redo');
  });
});
