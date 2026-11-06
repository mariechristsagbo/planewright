// Checks the record of the keyboard, offline and layout batch (s58–s64) against its committed
// evidence: the load check, the gates and the 403 that stopped live contact before s65, the REA
// windows, the replays, the keyboard focus (R-27), the offline start and reconnection (R-57), the
// layout by viewport (R-23), Find on canvas, the language and the canvas background (R-05), the
// library item (R-15), and the rows that cite them.
import { describe, expect, it } from 'vitest';

import { RE, cells, differing, doc, entry, evidence, flat, probe, read } from './r76-evidence.mjs';

const section = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Keyboard, offline and layout batch (s58–s64)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's58-mobile-load-gate',
  's59-mobile-keyboard-resize',
  's60-mobile-offline',
  's61-mobile-find-language-library',
  's62-mobile-keyboard-resize-2',
  's63-mobile-offline-2',
  's64-mobile-find-library',
];
const [, WALK, OFFLINE, FIND, WALK2, OFFLINE2, FIND2] = SESSIONS;
const index = () => evidence('sessions-s58-s64.json').sessions;
const focused = (name, label) => probe(name, label).focused;
const rectangle = (name, label) =>
  probe(name, label).layout.buttons.find((b) => b.name === 'Rectangle').boxes[0];

describe('the loads, the gates, the stop and the windows of the batch', () => {
  it('state the assertion and failure counts, and that each load got one HTTP 200 document', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { network } of index()) {
      const fetched = network.filter((n) => n.type === 'document' && !n.fromServiceWorker);
      expect(fetched.map((n) => [n.status, n.count])).toEqual([[200, 1]]);
      expect(network.some((n) => n.path?.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path?.endsWith('.map'))).toBe(false);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([1, 15, 6, 7, 29, 6, 9]);
    expect(index().map((s) => s.steps.failed)).toEqual([0, 0, 0, 0, 1, 0, 1]);
    expect(section()).toContain('(1 in s58, 15 in s59, 6 in s60 and s63, 7 in s61, 29 in s62');
    expect(section()).toContain('the Close after 56’s Space in s62 and the second Close of 58');
  });

  it('record the 403 on the locale chunk in s64 and that s65 never ran', () => {
    const failed = index()[6].network.filter((n) => n.event === 'request-failed');
    expect(failed.map((n) => n.path)).toEqual([
      expect.stringMatching(/^\/assets\/locales\/fr-FR/u),
    ]);
    expect(section()).toContain('REA saw HTTP 403 for it');
    expect(section()).toContain('s65 never ran');
    expect(doc('limitations.md')).toContain('the fr-FR locale chunk got HTTP 403');
    expect(doc('checkpoint.md')).toContain('stopped all live contact after s64');
  });

  it('state the REA window leads and what the windows kept', () => {
    const windows = evidence('rea-windows-s58-s64.json').windows;
    expect(windows).toHaveLength(18);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = windows.filter((w) => w.driver.first_step_at).map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '2.5',
      '3.6',
    ]);
    const kept = windows.filter((w) => w.network_requests > 0).map((w) => w.file);
    expect(kept).toEqual(['r03-inspect-during-54.json', 'r03-inspect-during-54.json']);
    expect(windows.filter((w) => w.console_events > 0)).toHaveLength(3);
    expect(section()).toContain('15 windows over scenarios, armed 2.5–3.6 s before');
  });

  it('state the replays and their only differences', () => {
    expect(differing(WALK2, WALK)).toEqual({
      shared: 48,
      labels: ['52-390x844-start', '52-480x844'],
    });
    expect(differing(OFFLINE2, OFFLINE)).toEqual({ shared: 8, labels: [] });
    expect(differing(FIND2, FIND)).toEqual({ shared: 13, labels: ['54-fr'] });
    expect(section()).toContain('48 labels, all identical but the first two rows of 52');
    expect(section()).toContain('238beca');
  });
});

describe('the keyboard focus (R-27)', () => {
  it('state that Tab never moved the focus from the app container on the first load', () => {
    for (const name of [WALK, WALK2]) {
      const rows = evidence(`probes-${name}.json`).filter((p) => p.label.startsWith('49-'));
      const reads = rows.filter((p) => p.focused).map((p) => JSON.stringify(p.focused));
      expect(reads).toHaveLength(36);
      expect(new Set(reads).size).toBe(1);
      expect(rows[0].focused).toMatchObject({ tag: 'DIV', tabIndex: 0, rect: [0, 0, 390, 844] });
      expect(rows[0].focused.outline[0]).toBe('none');
    }
    expect(section()).toContain('30 Tab presses and 4 Shift+Tab presses never moved the focus');
  });

  it('state the focus in the Library button, the choice popover, the menu and Help', () => {
    expect(focused(WALK2, '56-library-enter')).toMatchObject({
      name: 'Library',
      focusVisible: true,
    });
    expect(focused(WALK2, '56-library-clicked').focusVisible).toBe(false);
    expect(focused(WALK2, '56-tab-01').name).toBe('Lasso');
    expect(focused(WALK2, '56-menu-tab-5')).toMatchObject({ tag: 'DIV', role: 'menu' });
    expect(focused(WALK2, '56-help-tab-4').name).toBe('Close');
    expect(focused(WALK2, '56-help-tab-5')).toEqual(focused(WALK2, '56-help-open'));
    for (const label of ['56-menu-escape', '56-help-escape']) {
      expect(focused(WALK2, label).body).toBe(true);
    }
    expect(section()).toContain('Tab cycled through its four links and Close');
    expect(entry('B-43')).toBeDefined();
  });
});

describe('the offline start (R-57) and the layout by viewport (R-23)', () => {
  it('state the offline reads and that navigator.onLine read true after the offline reload', () => {
    for (const name of [OFFLINE, OFFLINE2]) {
      expect(probe(name, '50-offline').connectivity.onLine).toBe(false);
      expect(probe(name, '50-offline-reloaded').connectivity).toMatchObject({
        onLine: true,
        controlled: true,
      });
      expect(probe(name, '50-offline-reloaded').elements).toHaveLength(1);
      expect(probe(name, '24-after-reload').elements).toHaveLength(2);
      const failed = index()
        .find((s) => s.session === name)
        .network.filter((n) => n.event === 'request-failed');
      expect(failed.map((n) => n.origin).sort()).toEqual([
        'https://queue.simpleanalyticscdn.com',
        'https://sentry.io',
      ]);
    }
    expect(section()).toContain('navigator.onLine read true in the reloaded page');
    expect(doc('limitations.md')).toContain('navigator.onLine read true after a reload');
  });

  it('state where the phone layout gave way to the wide one', () => {
    const phone = ['52-390x844-start', '52-480x844', '52-844x390', '57-580x960', '57-844x450'];
    const wide = ['52-600x960', '52-1024x768', '52-1280x800', '57-844x520'];
    for (const label of phone) expect(rectangle(WALK2, label)[1], label).toBeGreaterThan(300);
    for (const label of wide) expect(rectangle(WALK2, label)[1], label).toBe(20);
    expect(section()).toContain(
      'a width between 580 and 600 px and a height between 450 and 520 px',
    );
    expect(entry('B-45')).toBeDefined();
  });
});

describe('Find, the language, the background and the library item (R-05, R-15)', () => {
  it('state the observed values', () => {
    expect(probe(FIND, '54-fr').layout.lang).toBe('fr-FR');
    expect(probe(FIND2, '58-placed').elements.at(-1).box).toEqual([165, 382, 60, 80]);
    expect(probe(FIND2, '58-added').selected).toBe(0);
    expect(probe(FIND2, '59-typed').background).toBe('#ffc9c9');
    expect(probe(FIND2, '59-undo').background).toBe('#ffc9c9');
    expect(probe(FIND, '53-find-open').focused.tag).toBe('INPUT');
    expect(section()).toContain('1 / 2 results');
    expect(section()).toContain('[165,382,60,80]');
    for (const id of ['B-46', 'B-47', 'B-48', 'B-49']) expect(entry(id), id).toBeDefined();
  });

  it('cite the sessions in the rows they changed, with R-27 and R-57 no longer unobserved', () => {
    expect(cells('R-27')[5]).toBe('🟡');
    expect(cells('R-57')[5]).toBe('🟡');
    const cited = { 'R-27': ['s59', 's62'], 'R-57': ['s60', 's63'], 'R-23': ['s59', 's62'] };
    Object.assign(cited, { 'R-05': ['s61', 's64'], 'R-15': ['s61', 's64'] });
    for (const [id, names] of Object.entries(cited)) {
      for (const name of names) expect(cells(id)[6], `${id} ${name}`).toContain(name);
    }
  });
});
