// Checks the record of the library undo, offline and language batch (s68–s70) against its
// committed evidence: the loads and the strict gate, the REA windows, Undo and Redo after the
// library item (R-15) and 09b's reload (R-54), the offline state across a reload (R-57), 54's
// French labels (R-05), the replays, and the entries and rows that cite them.
import { describe, expect, it } from 'vitest';

import {
  RE,
  cells,
  differing,
  doc,
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
      .split('## Library undo, offline and language batch (s68–s70)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's68-mobile-library-undo-offline',
  's69-mobile-library-undo-offline-2',
  's70-mobile-language-2',
];
const [UNDO, UNDO2, LANGUAGE] = SESSIONS;
const index = () => evidence('sessions-s68-s70.json').sessions;
const online = (name, label) => probe(name, label).connectivity.onLine;
const placements = (name) =>
  evidence('netlog-steps-s68-s70.json').sessions.find((s) => s.session === name).placements;

// Seconds from 50's offline reload, the second reload of the chain, to the first read after it.
const gap = (name) => {
  const reload = placements(name).filter((p) => p.do === 'reload')[1].started;
  return (Date.parse(probe(name, '50-offline-reloaded').at) - Date.parse(reload)) / 1000;
};

describe('the loads, the strict gate and the windows of the s68–s70 batch', () => {
  it('state one network document per load, service worker reloads and no 403 or 429', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    const documents = (s) =>
      s.network
        .filter((n) => n.type === 'document')
        .map((n) => [n.status, n.count, Boolean(n.fromServiceWorker)]);
    const chain = [
      [200, 1, false],
      [200, 3, true],
    ];
    expect(index().map(documents)).toEqual([chain, chain, [[200, 1, false]]]);
    for (const { network } of index()) {
      expect(network.some((n) => [403, 429].includes(n.status))).toBe(false);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
      const failed = network.filter((n) => n.event === 'request-failed');
      expect(failed.some((n) => n.origin.endsWith('excalidraw.com'))).toBe(false);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([9, 9, 5]);
    expect(index().map((s) => s.steps.failed)).toEqual([0, 0, 0]);
    expect(section()).toContain('(9 in s68 and s69, 5 in s70)');
    expect(order('s68')).toEqual(['09', '60', '09b', '50', '61', '51', '24', '16']);
    expect(order('s69')).toEqual(order('s68'));
    expect(order('s70')).toEqual(['09', '53', '54', '16']);
  });

  it('state the window leads, the one window over 61 and 51, and the one request over 54', () => {
    const windows = evidence('rea-windows-s68-s70.json').windows;
    expect(windows).toHaveLength(10);
    const over = windows.filter((w) => w.driver.steps > 0);
    expect(over).toHaveLength(6);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = over.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '3.1',
      '3.6',
    ]);
    for (const w of over.filter((x) => x.file === 'r06-inspect-during-61-51.json')) {
      expect(w.driver.probe_labels).toEqual(expect.arrayContaining(['61-reloaded', '51-offline']));
    }
    for (const w of windows) {
      const counts = [w.network_requests, w.websocket_connections, w.console_events];
      expect(counts, w.file).toEqual(
        w.file === 'r03-inspect-during-54.json' ? [1, 0, 0] : [0, 0, 0],
      );
    }
    expect(section()).toContain('6 windows over scenarios, armed 3.1–3.6 s before');
  });
});

describe('Undo after the library item (R-15) and the reload of 09b (R-54)', () => {
  it('state what Undo and Redo did after the add and after the placement, in both runs', () => {
    for (const name of [UNDO, UNDO2]) {
      expect(probe(name, '60-added').elements).toHaveLength(1);
      expect(probe(name, '60-added').selected).toBe(0);
      expect(probe(name, '60-added-undo').elements).toEqual([]);
      expect(probe(name, '60-added-redo').selected).toBe(1);
      expect(probe(name, '60-placed').elements.at(-1).box).toEqual([165, 382, 60, 80]);
      expect(probe(name, '60-placed-undo').elements).toHaveLength(1);
      expect(probe(name, '60-placed-undo').selected).toBe(0);
      expect(probe(name, '60-placed-redo').elements).toHaveLength(2);
      expect(probe(name, '60-placed-redo').selected).toBe(1);
    }
    expect(section()).toContain('it removed the rectangle itself');
    expect(field(entry('B-48'), 'Undo/redo')).toContain('60-placed-undo');
    expect(field(entry('B-48'), 'Reproduction')).toContain('60 (s68, s69)');
  });

  it('record that 09b ran, after 60, and that the scene survived its reload', () => {
    for (const name of [UNDO, UNDO2]) {
      const kept = probe(name, '50-online').elements.slice(0, 2);
      expect(kept).toEqual(probe(name, '60-end').elements);
    }
    expect(index().map((s) => s.steps.byKind.reload ?? 0)).toEqual([3, 3, 0]);
    expect(field(entry('B-30'), 'Desktop/mobile')).toContain('Scenario 09b ran first in s68');
    for (const text of [cells('R-54')[7], cells('R-76')[7], doc('README.md')]) {
      expect(flat(text)).not.toContain('09b never ran');
    }
    expect(doc('limitations.md')).not.toContain('scenario 09b never ran');
  });
});

describe('the offline state across a reload (R-57)', () => {
  it('state that navigator.onLine stayed false across the offline reload with the new step', () => {
    const offline = ['50-offline', '50-offline-reloaded', '61-reloaded', '61-reapplied'];
    for (const name of [UNDO, UNDO2]) {
      for (const label of [...offline, '51-offline']) {
        expect(online(name, label), `${name} ${label}`).toBe(false);
      }
      expect(online(name, '51-online-again')).toBe(true);
    }
    for (const name of ['s60-mobile-offline', 's63-mobile-offline-2']) {
      expect(online(name, '50-offline-reloaded'), name).toBe(true);
    }
    expect(section()).toContain('where s60 and s63 read true');
    expect(field(entry('B-44'), 'Reproduction')).toContain('(s68, s69)');
    expect(cells('R-57')[6]).toContain('s68 and s69');
    expect(cells('R-57')[8]).not.toContain('Re-apply the offline state');
  });

  it('state how long after the offline reload the first read came', () => {
    expect([UNDO, UNDO2].map((name) => gap(name).toFixed(1))).toEqual(['4.5', '5.6']);
    expect(section()).toContain('4.5 s and 5.6 s after the reload');
  });

  it('state which shared rows differ from the earlier offline runs, and why', () => {
    const labels = ['50-online', '50-offline-reloaded', '51-offline', '51-offline-drawn'];
    labels.push('51-online-again', '24-before-reload', '24-after-reload');
    for (const earlier of ['s60-mobile-offline', 's63-mobile-offline-2']) {
      expect(differing(UNDO, earlier)).toEqual({ shared: 8, labels });
    }
    expect(section()).toContain('in 7 of their 8 shared labels');
  });
});

describe('the French labels (R-05) and the replays', () => {
  it('state that 54 loaded the French labels again, through the service worker', () => {
    expect(differing(LANGUAGE, 's61-mobile-find-language-library')).toEqual({
      shared: 13,
      labels: [],
    });
    expect(differing(LANGUAGE, 's64-mobile-find-library')).toEqual({
      shared: 13,
      labels: ['54-fr'],
    });
    const library = probe(LANGUAGE, '54-fr').layout.buttons.find((b) => b.name === 'Library');
    expect(library.boxes).toEqual([]);
    const locale = placements(LANGUAGE)
      .flatMap((p) => p.entries)
      .filter((e) => e.includes('/assets/locales/'));
    expect(locale).toHaveLength(1);
    expect(locale[0]).toMatch(/ request script 200 \S+ sw /u);
    expect(field(entry('B-47'), 'Confidence')).toMatch(/^\[O\] high/u);
    expect(field(entry('B-47'), 'Reproduction')).toContain('(s61, s64, s70)');
    expect(cells('R-05')[6]).toContain('s70');
    expect(cells('R-05')[8]).not.toContain('a second mobile run of 54');
  });

  it('state that s69 matches s68, and cite the sessions in the rows they changed', () => {
    expect(differing(UNDO2, UNDO)).toEqual({ shared: 19, labels: [] });
    expect(section()).toContain('s69 against s68: 19 labels, all identical');
    const testing = flat(
      read(`${RE}/checkpoint.md`)
        .split('\n')
        .find((line) => line.startsWith('| Re-run each documented interaction')),
    );
    expect(testing).not.toContain('09b never ran');
    expect(testing).toContain('so 54’s French labels have loaded twice');
    const cited = [
      ['R-05', 's70'],
      ['R-15', 's69'],
      ['R-52', 's68'],
      ['R-54', 's69'],
      ['R-57', 's69'],
    ];
    for (const [id, name] of cited) expect(cells(id)[6], `${id} ${name}`).toContain(name);
    expect(cells('R-52')[7]).not.toContain('B-48 (R-15)');
    expect(cells('R-15')[8]).not.toContain('Undo after placing');
  });
});
