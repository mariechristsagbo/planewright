// Checks the record of the preferences, modes and eraser batch (s71–s73) against its committed
// evidence: the loads and the strict gate, the REA windows, the eraser with Undo and a bound
// target (R-44), the Preferences toggles with Undo, Tool lock and the reloads (R-19, R-02), the
// System theme, Overlap and the wheel (R-26, R-12, R-33), the replays, and the entries and rows
// that cite them.
import { describe, expect, it } from 'vitest';

import {
  RE,
  cells,
  differing,
  entry,
  evidence,
  field,
  flat,
  order,
  probe,
  read,
} from './r76-evidence.mjs';

const section = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Preferences, modes and eraser batch (s71–s73)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's71-mobile-preferences-eraser',
  's72-mobile-preferences-eraser-2',
  's73-mobile-eraser-bound',
];
const [FIRST, SECOND, ERASER] = SESSIONS;
const index = () => evidence('sessions-s71-s73.json').sessions;
const reference = (origin) => {
  const host = new URL(origin).hostname;
  return host === 'excalidraw.com' || host.endsWith('.excalidraw.com');
};
const arrows = (name, label) => probe(name, label).elements.filter((e) => e.type === 'arrow');

describe('the loads, the strict gate and the windows of the s71–s73 batch', () => {
  it('state one network document per load, the reloads from the service worker and no 403', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    const documents = (s) =>
      s.network
        .filter((n) => n.type === 'document')
        .map((n) => [n.status, n.count, Boolean(n.fromServiceWorker)]);
    const chain = [
      [200, 1, false],
      [200, 2, true],
    ];
    expect(index().map(documents)).toEqual([chain, chain, [[200, 1, false]]]);
    for (const { network } of index()) {
      expect(network.some((n) => [403, 429].includes(n.status))).toBe(false);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
      const failed = network.filter((n) => n.event === 'request-failed');
      expect(failed.some((n) => reference(n.origin))).toBe(false);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([10, 12, 5]);
    expect(index().map((s) => s.steps.failed)).toEqual([0, 0, 0]);
    expect(section()).toContain('(10 in s71, 12 in s72 and 5 in s73)');
    expect(order('s71')).toEqual(['09', '62', '63', '64', '65', '16']);
    expect(order('s72')).toEqual(['09', '62', '66', '63', '64', '65', '16']);
    expect(order('s73')).toEqual(['09', '62', '66', '16']);
  });

  it('state the window leads and that no window kept a request', () => {
    const windows = evidence('rea-windows-s71-s73.json').windows;
    expect(windows).toHaveLength(11);
    const over = windows.filter((w) => w.driver.steps > 0);
    expect(over).toHaveLength(9);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = over.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '2.9',
      '3.6',
    ]);
    for (const w of windows) {
      expect([w.network_requests, w.websocket_connections, w.console_events], w.file).toEqual([
        0, 0, 0,
      ]);
    }
    expect(section()).toContain('9 windows over scenarios, armed 2.9–3.6 s before');
  });
});

describe('the eraser (R-44)', () => {
  it('state that Undo after an erase of a selected rectangle left the Selection tool active', () => {
    for (const name of SESSIONS) {
      expect(probe(name, '62-erased-free').elements).toHaveLength(3);
      expect(probe(name, '62-erased-free').tool).toBe('eraser');
      expect(probe(name, '62-erased-free-undo').tool).toBe('selection');
      expect(probe(name, '62-erased-free-undo').selected).toBe(1);
      const left = probe(name, '62-erased-free-redo').elements;
      expect(probe(name, '62-erased-bound').elements).toEqual(left);
    }
    expect(section()).toContain('erased nothing');
    expect(field(entry('B-29'), 'Undo/redo')).toContain('62-erased-free-undo');
  });

  it('state what erasing an arrow end target and the arrow did, with Undo, in both runs', () => {
    for (const name of [SECOND, ERASER]) {
      const [cut] = arrows(name, '66-erased-target');
      expect([cut.startBound, cut.endBound]).toEqual([true, false]);
      expect(probe(name, '66-erased-target').elements).toHaveLength(3);
      const [back] = arrows(name, '66-erased-target-undo');
      expect([back.startBound, back.endBound]).toEqual([true, true]);
      expect(probe(name, '66-erased-target-undo').tool).toBe('eraser');
      expect(arrows(name, '66-erased-arrow')).toEqual([]);
      for (const e of probe(name, '66-erased-arrow').elements) expect(e.bound).toEqual([]);
      expect(arrows(name, '66-erased-arrow-undo')).toHaveLength(1);
      expect(probe(name, '66-escape').tool).toBe('selection');
    }
    expect(field(entry('B-29'), 'Edge cases')).toContain('66-erased-target');
    expect(field(entry('B-29'), 'Reproduction')).toContain('62 and 66 (s71–s73)');
    expect(cells('R-44')[4]).toBe('✅/❌/✅');
  });
});

describe('the Preferences toggles, Tool lock and the reloads (R-19, R-02)', () => {
  it('state that a grid toggle and a theme change are not undo steps', () => {
    for (const name of [FIRST, SECOND]) {
      expect(probe(name, '63-grid').modes.grid).toBe(true);
      expect(probe(name, '63-grid-undo').modes.grid).toBe(true);
      expect(probe(name, '63-grid-undo').selected).toBe(1);
      expect(probe(name, '63-dark-undo').theme).toBe('dark');
      expect(probe(name, '63-dark-undo').selected).toBe(1);
    }
    expect(field(entry('B-37'), 'Undo/redo')).toContain('not an undo step');
    expect(cells('R-19')[4]).toBe('✅/🟡/✅');
  });

  it('state that Tool lock kept the Rectangle tool and held after Selection was picked', () => {
    for (const name of [FIRST, SECOND]) {
      for (const label of ['63-locked-1', '63-locked-2']) {
        expect(probe(name, label).tool).toBe('rectangle');
        expect(probe(name, label).selected).toBe(0);
        expect(probe(name, label).modes.toolLocked).toBe(true);
      }
      expect(probe(name, '63-selection').modes.toolLocked).toBe(true);
      expect(probe(name, '63-tool-unlock').modes.toolLocked).toBe(false);
    }
    expect(cells('R-02')[6]).toContain('s71');
  });

  it('state that Snap to objects turned the grid off and which modes a reload kept', () => {
    for (const name of [FIRST, SECOND]) {
      expect(probe(name, '65-dark').modes.grid).toBe(true);
      expect(probe(name, '65-snap').modes).toMatchObject({ grid: false, snap: true });
      const before = probe(name, '65-before-reload');
      const after = probe(name, '65-after-reload');
      expect(after.modes).toEqual(before.modes);
      expect(after.modes).toMatchObject({ zen: true, snap: true, boxSelection: 'overlap' });
      expect(after.theme).toBe('dark');
      expect('view' in probe(name, '65-view').modes).toBe(false);
    }
    expect(section()).toContain('turned the grid off');
    expect(field(entry('B-37'), 'Persistence')).toContain('65-after-reload');
  });
});

describe('the System theme, Overlap, Arrow binding and the wheel (R-26, R-12, R-33)', () => {
  it('state the stored theme under each emulated scheme and the partial box per mode', () => {
    for (const name of [FIRST, SECOND]) {
      const themes = ['64-system-dark', '64-system-light', '64-system-dark-again'];
      expect(themes.map((label) => probe(name, label).theme)).toEqual(['dark', 'light', 'dark']);
      expect(probe(name, '64-wrap-partial').selected).toBe(0);
      expect(probe(name, '64-wrap-partial').modes.boxSelection).toBe('contain');
      expect(probe(name, '64-overlap-partial').selected).toBe(1);
    }
    expect(field(entry('B-28'), 'Edge cases')).toContain('64-system-light');
    expect(field(entry('B-12'), 'Edge cases')).toContain('64-overlap-partial');
    expect(cells('R-26')[6]).toContain('s71');
    expect(cells('R-33')[6]).toContain('s72');
  });

  it('state the arrows drawn with binding off and on, and the wheel per input device', () => {
    for (const name of [FIRST, SECOND]) {
      const off = arrows(name, '64-arrow-unbound').at(-1);
      expect([off.startBound, off.endBound]).toEqual([false, false]);
      const on = arrows(name, '64-arrow-bound').at(-1);
      expect([on.startBound, on.endBound]).toEqual([true, true]);
      expect(probe(name, '64-wheel-trackpad')).toMatchObject({ zoom: 1, scroll: [0, -40] });
      expect(probe(name, '64-wheel-mouse')).toMatchObject({ zoom: 0.9, scroll: [33, 33] });
      expect(probe(name, '64-wheel-mouse-back')).toMatchObject({ zoom: 1, scroll: [0, 0] });
    }
    expect(cells('R-12')[6]).toContain('s72');
    expect(cells('R-12')[7]).not.toContain('No radio chosen');
  });
});

describe('the replays and the rows that cite them', () => {
  it('state that s72 matches s71 and s73 matches s72 in every shared label', () => {
    expect(differing(SECOND, FIRST)).toEqual({ shared: 49, labels: [] });
    expect(differing(ERASER, SECOND)).toEqual({ shared: 20, labels: [] });
    expect(section()).toContain('s72 against s71: 49 labels, all identical');
    expect(section()).toContain('s73 against s72: 20 labels, all identical');
    for (const id of ['R-19', 'R-44', 'R-52']) expect(cells(id)[6], id).toContain('s72');
    expect(cells('R-52')[7]).not.toContain('B-28 and B-37 (R-19)');
    expect(cells('R-19')[7]).not.toContain('undo of a toggle or theme change not tested');
  });
});
