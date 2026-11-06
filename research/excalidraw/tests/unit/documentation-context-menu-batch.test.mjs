// Checks the record of the context-menu, tools and snap batch (s74–s78) against its committed
// evidence: the loads and the strict gate, the REA windows, the requests during 70 and 71, the
// listener inspection and the matched captures (R-65, R-71), and the replays.
import { describe, expect, it } from 'vitest';

import { RE, cells, differing, evidence, flat, order, read } from './r76-evidence.mjs';

const section = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Context-menu, tools and snap batch (s74–s78)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's74-mobile-context-tools',
  's75-mobile-context-items',
  's76-mobile-context-items-2',
  's77-mobile-paste-styles',
  's78-mobile-paste-styles-2',
];
const index = () => evidence('sessions-s74-s78.json').sessions;
const reference = (origin) => {
  const host = new URL(origin).hostname;
  return host === 'excalidraw.com' || host.endsWith('.excalidraw.com');
};

describe('the loads, the strict gate and the windows of the s74–s78 batch', () => {
  it('state one network document per load, no reload and no 403', () => {
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
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([17, 21, 23, 7, 7]);
    expect(index().map((s) => s.steps.failed)).toEqual([0, 1, 4, 0, 0]);
    expect(section()).toContain('(17 in s74, 21 in s75, 23 in s76 and 7 each in s77 and s78)');
    expect(order('s74')).toEqual(['09', '67', '69', '70', '72', '74', '68', '71', '73', '16']);
    expect(order('s76')).toContain('77');
    expect(order('s78')).toEqual(['09', '72', '76', '78', '16']);
  });

  it('state the window leads and the requests kept over 70 and 71 only', () => {
    const windows = evidence('rea-windows-s74-s78.json').windows;
    expect(windows).toHaveLength(32);
    const lead = (w) => (Date.parse(w.driver.first_step_at) - Date.parse(w.window.start)) / 1000;
    const leads = windows.map(lead);
    expect([Math.min(...leads), Math.max(...leads)].map((n) => n.toFixed(1))).toEqual([
      '0.6',
      '3.5',
    ]);
    for (const w of windows) {
      const kept = w.file.includes('during-70') ? 1 : w.file.includes('during-71') ? 4 : 0;
      expect([w.network_requests, w.websocket_connections, w.console_events], w.file).toEqual([
        kept,
        0,
        0,
      ]);
    }
    expect(windows.filter((w) => w.network_requests === 0)).toHaveLength(26);
    expect(section()).toContain('32 windows over scenarios, armed 0.6–3.5 s before');
  });

  it('state that no request started while drawing', () => {
    const placed = evidence('netlog-steps-s74-s78.json').sessions;
    const starts = placed.map((s) => s.drawing.request_starts);
    expect(starts.reduce((sum, s) => sum + s.known, 0)).toBe(110);
    expect(starts.every((s) => s.during_drawing === 0 && s.unknown === 0)).toBe(true);
    const steps = placed.flatMap((s) => Object.values(s.drawing.steps));
    expect(steps.reduce((sum, n) => sum + n, 0)).toBe(80);
    expect(section()).toContain(
      'none of the 110 request starts fell in one of the 80 drawing steps',
    );
  });
});

describe('the listener inspection and the matched captures (R-65, R-71)', () => {
  it('state the three listeners on the interactive canvas and keep no source text', () => {
    const summary = evidence('rea-listeners-s76.summary.json');
    expect(summary.listeners.map((l) => l.type)).toEqual(['click', 'touchstart', 'touchend']);
    for (const l of summary.listeners)
      expect([l.use_capture, l.passive, l.once]).toEqual([false, false, false]);
    const text = JSON.stringify(summary);
    for (const absent of ['line_number', 'source_map', '"text"', 'script_id']) {
      expect(text.includes(absent), absent).toBe(false);
    }
    expect(cells('R-65')[4]).toBe('❌/❌/🟡');
    expect(section()).toContain('click, touchstart and touchend, none capturing, passive or once');
  });

  it('state that each CSS-scale capture matches the REA capture byte for byte', () => {
    for (const [short, name] of [
      ['s74', SESSIONS[0]],
      ['s75', SESSIONS[1]],
      ['s76', SESSIONS[2]],
    ]) {
      const rea = evidence(`rea-screenshot-${short}.summary.json`).png;
      const shots = index().find((s) => s.session === name).screenshots;
      const css = shots.find((s) => s.name === 'm74-01-css.png');
      expect([css.sha256 === rea.sha256, css.width, css.height], short).toEqual([true, 390, 844]);
      expect(shots.find((s) => s.name === 'm74-02-device.png').width).toBe(1170);
    }
    expect(cells('R-71')[4]).toBe('—/—/✅');
    expect(cells('R-71')[8]).toBe('None needed');
  });
});

describe('the replays of the s74–s78 batch', () => {
  it('state the shared labels and which differ, and that s78 matches s77', () => {
    expect(differing(SESSIONS[4], SESSIONS[3])).toEqual({ shared: 37, labels: [] });
    const first = differing(SESSIONS[1], SESSIONS[0]);
    expect(first.shared).toBe(68);
    expect(first.labels).toEqual([
      '68-element-right',
      '71-zoom-fit',
      '71-reset-zoom-again',
      '73-before',
      '73-cleared-undo',
    ]);
    expect(differing(SESSIONS[2], SESSIONS[1]).shared).toBe(96);
    expect(differing(SESSIONS[3], SESSIONS[2]).shared).toBe(25);
    expect(section()).toContain('s75 against s74: 68 shared labels');
    expect(section()).toContain('s78 against s77: 37 labels, all identical');
  });
});
