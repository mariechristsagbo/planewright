// Checks the record of the replay batch (s65–s67) against its committed evidence: the loads and
// the strict gate, the REA windows, the replays of 56–59 and 55 against their first runs, and the
// entries and rows that cite them.
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
  flat(read(`${RE}/checkpoint.md`).split('## Replay batch (s65–s67)\n')[1].split(/^## /mu)[0]);
const SESSIONS = [
  's65-mobile-keyboard-resize-3',
  's66-mobile-library-background-2',
  's67-mobile-library-sidebar-2',
];
const [WALK3, LIBRARY2, SIDEBAR2] = SESSIONS;
const index = () => evidence('sessions-s65-s67.json').sessions;

describe('the loads, the strict gate and the windows of the replay batch', () => {
  it('state one HTTP 200 document per load and no 403, 429 or failed request', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { network } of index()) {
      const fetched = network.filter((n) => n.type === 'document' && !n.fromServiceWorker);
      expect(fetched.map((n) => [n.status, n.count])).toEqual([[200, 1]]);
      expect(network.some((n) => [403, 429].includes(n.status))).toBe(false);
      expect(network.some((n) => n.event === 'request-failed')).toBe(false);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([29, 7, 5]);
    expect(index().map((s) => s.steps.failed)).toEqual([1, 1, 0]);
    expect(section()).toContain('(29 in s65, 7 in s66 and 5 in s67)');
    expect(section()).toContain(
      'the Close after 56’s Space in s65 and the second Close of 58 in s66',
    );
  });

  it('describe the strict gate and the sessions it fails on the retained records', () => {
    expect(section()).toContain('a 403 or 429 of any request type');
    expect(section()).toContain(
      'fails s12, s13, s14, s16, s49, s50 and s64 and passes the other 56',
    );
    expect(doc('methodology.md')).toContain('From s65 the gate stops');
    expect(order('s65')).toEqual(['09', '49', '56', '52', '57', '16']);
    expect(order('s66')).toEqual(['09', '53', '58', '59', '16']);
    expect(order('s67')).toEqual(['09', '53', '55', '16']);
  });

  it('state the REA window leads and that every window kept nothing', () => {
    const windows = evidence('rea-windows-s65-s67.json').windows;
    expect(windows).toHaveLength(9);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = windows.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '1.6',
      '3.3',
    ]);
    for (const w of windows) {
      expect([w.network_requests, w.websocket_connections, w.console_events], w.file).toEqual([
        0, 0, 0,
      ]);
    }
    expect(section()).toContain('9 windows over scenarios, armed 1.6–3.3 s before');
  });
});

describe('the replays of 55–59', () => {
  it('state that each replay matches its first run in every shared probe', () => {
    expect(differing(WALK3, 's62-mobile-keyboard-resize-2')).toEqual({ shared: 88, labels: [] });
    expect(differing(LIBRARY2, 's64-mobile-find-library')).toEqual({ shared: 16, labels: [] });
    expect(differing(SIDEBAR2, 's61-mobile-find-language-library')).toEqual({
      shared: 11,
      labels: [],
    });
    expect(probe(LIBRARY2, '58-placed').elements.at(-1).box).toEqual([165, 382, 60, 80]);
    expect(probe(LIBRARY2, '59-undo').background).toBe('#ffc9c9');
    expect(probe(WALK3, '56-tab-01').focused.name).toBe('Lasso');
    expect(section()).toContain('s65’s 88 labels match s62’s, s66’s 16 match s64’s');
    expect(section()).toContain('a query value of the off-site Browse libraries link');
  });

  it('raise the entries and rows that rested on one run', () => {
    for (const id of ['B-48', 'B-49'])
      expect(field(entry(id), 'Confidence'), id).toMatch(/^\[O\] high/u);
    expect(field(entry('B-43'), 'Reproduction')).toContain('56 (s62, s65)');
    expect(field(entry('B-45'), 'Reproduction')).toContain('57 (s62, s65)');
    expect(cells('R-27')[8]).not.toContain('replay 56');
    expect(cells('R-27')[7]).not.toContain('56 ran once');
    expect(cells('R-23')[7]).not.toContain('57 ran once');
    for (const [id, name] of [
      ['R-27', 's65'],
      ['R-23', 's65'],
      ['R-05', 's66'],
      ['R-15', 's67'],
    ]) {
      expect(cells(id)[6], `${id} ${name}`).toContain(name);
    }
    const testing = flat(
      read(`${RE}/checkpoint.md`)
        .split('\n')
        .find((line) => line.startsWith('| Re-run each documented interaction')),
    );
    expect(testing).not.toContain('55–59 ran once');
    expect(testing).toContain('55–59 have now each run twice');
  });
});
