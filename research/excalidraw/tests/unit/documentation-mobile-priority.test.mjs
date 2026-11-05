// Checks the record of the mobile priority-1 batch (s17–s21) against its committed evidence: the
// sessions and REA windows, the tap ladder (R-34), the pinch ratios, anchor and limits (R-48), the
// reload with a selection (R-54), the request start times and the rows and entries that cite them.
import { describe, expect, it } from 'vitest';

import { cells, entry, evidence, field, flat, read } from './r76-evidence.mjs';

const section = () =>
  flat(
    read('docs/reverse-engineering/checkpoint.md')
      .split('## Mobile priority-1 batch (s17–s21)\n')[1]
      .split(/^## /mu)[0],
  );
const HIT = ['s17-mobile-hit-reload', 's19-mobile-hit-reload-2', 's21-mobile-hit-reload-3'];
const PINCH = ['s18-mobile-pinch', 's20-mobile-pinch-2'];
const index = (name) => evidence('sessions-s17-s21.json').sessions.find((s) => s.session === name);
const probes = (name) => new Map(evidence(`probes-${name}.json`).map((p) => [p.label, p]));
const strip = (p) => JSON.stringify({ ...p, at: undefined, label: undefined });
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
// The ladder offsets at which a tap selected the shape, from the probe labels 25-<shape>-<offset>.
const OFFSET = { centre: 60, 0: 0 };
const offset = (tag) => OFFSET[tag] ?? Number(tag.slice(1)) * (tag.startsWith('m') ? -1 : 1);
const selectedAt = (name, shape) =>
  [...probes(name).values()]
    .filter((p) => p.label.startsWith(`25-${shape}-`) && p.selected === 1)
    .map((p) => offset(p.label.split('-')[2]));

describe('the sessions and REA windows of the mobile priority-1 batch', () => {
  it('state the gates, the assertions and the metrics read after each load', () => {
    for (const name of [...HIT, ...PINCH]) {
      const { steps } = index(name);
      expect(steps.byKind.assertMetrics).toBe(HIT.includes(name) ? 7 : 3);
      expect(steps.failures.map((f) => f.step)).toEqual(name === HIT[0] ? ['role'] : []);
      const loaded = steps.metrics.filter((m) => m.canvases.length > 0);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({ innerWidth: 390, orientationType: 'portrait-primary' });
      for (const c of loaded[0].canvases) expect([c.width, c.height]).toEqual([1170, 2532]);
    }
    expect(section()).toContain(
      'No metrics assertion failed (7 in each of s17, s19 and s21, 3 in each of s18 and s20)',
    );
    expect(section()).toContain('every load and every reload passed [O]');
  });

  it('state how early the windows armed and that none kept a request', () => {
    const wins = evidence('rea-windows-s17-s21.json').windows;
    expect(wins).toHaveLength(11);
    const over = wins.filter((w) => w.driver.first_step_at);
    expect(over.map((w) => /during-(\d+)/u.exec(w.file)[1]).join(' ')).toBe(
      '25 27 26 25 27 26 25 27',
    );
    const leads = over.map((w) => Date.parse(w.driver.first_step_at) - Date.parse(w.window.start));
    for (const w of over)
      expect(Date.parse(w.window.end)).toBeGreaterThan(Date.parse(w.driver.last_step_at));
    for (const w of wins) {
      expect(w.allowed_origins).toHaveLength(7);
      expect([w.network_requests, w.websocket_connections, w.console_events]).toEqual([0, 0, 0]);
    }
    expect(section()).toContain(
      `armed ${seconds(Math.min(...leads))}–${seconds(Math.max(...leads))} s before the scenario's first step`,
    );
    expect(section()).toContain(
      'All 11 windows returned Evidence and kept 0 requests, 0 WebSocket connections and 0 console events',
    );
  });
});

describe('the hit-testing record (R-34)', () => {
  it('states the offsets at which a tap selected each rectangle', () => {
    const near = [-4, -2, 0, 2, 4];
    for (const name of HIT) expect(selectedAt(name, 'transparent')).toEqual(near);
    expect(selectedAt(HIT[0], 'filled')).toEqual(near);
    for (const name of HIT.slice(1))
      expect(selectedAt(name, 'filled')).toEqual([...near, 8, 12, 16, 24, 60]);
    const fill = (name) => probes(name).get('25-shapes').elements[1].style[1];
    expect(HIT.map(fill)).toEqual(['transparent', '#a5d8ff', '#a5d8ff']);
    expect(section()).toContain(
      'A tap from −4 to +4 px selected the transparent rectangle, and a tap at ±8 px or more, or at the centre, did not, in all four of its ladders',
    );
    expect(section()).toContain('a tap 8 px or more outside did not [O]');
  });

  it('marks R-34 observed on mobile only, and B-10 says so', () => {
    expect(cells('R-34').map(flat).slice(4, 6)).toEqual(['❌/❌/✅', '🟡']);
    expect(field(entry('B-10'), 'Edge cases')).toMatch(
      /within 4 px of its stroke.*Not observed \(R-34\)/u,
    );
  });
});

// The scene point that a zoom change kept still, from the rounded committed scroll.
const fixed = (a, b, axis) => (a.scroll[axis] - b.scroll[axis]) / (1 / a.zoom - 1 / b.zoom);
const pinchRows = (name) => {
  const pinches = JSON.parse(
    read('research/excalidraw/scenarios/26-pinch-ratios-limits-mobile.json'),
  ).steps.filter((s) => s.do === 'touchDrag' && s.from.length === 2);
  const p = probes(name);
  return pinches.map((step, i) => {
    const [before, after] = [
      i === 0 ? '26-start' : `26-p${String(i).padStart(2, '0')}`,
      `26-p${String(i + 1).padStart(2, '0')}`,
    ].map((l) => p.get(l));
    const along = step.from[0][1] === step.from[1][1] ? 0 : 1;
    const mid = [0, 1].map((k) => (step.from[0][k] + step.from[1][k]) / 2);
    if (before.zoom === after.zoom)
      return { clamped: true, pan: (after.scroll[along] - before.scroll[along]) * after.zoom };
    return {
      zoom: after.zoom,
      along: fixed(before, after, along) - mid[along],
      across: fixed(before, after, 1 - along) - mid[1 - along],
    };
  });
};

describe('the pinch record (R-48)', () => {
  it('states the zoom rule and the limits, the same in both sessions', () => {
    const zooms = (name) => [...probes(name).values()].map((p) => p.zoom);
    expect(zooms(PINCH[0])).toEqual([1, 2, 1, 1.5, 0.5, 0.1, 0.1, 0.1, 0.5, 2.5, 12.5, 30, 30, 30]);
    expect(zooms(PINCH[1])).toEqual(zooms(PINCH[0]));
    const boxes = (name) =>
      new Set([...probes(name).values()].map((p) => JSON.stringify(p.elements)));
    for (const name of PINCH) expect(boxes(name).size).toBe(1);
    expect(section()).toContain('until the zoom reached 0.1 or 30, which held');
  });

  it('states where the fixed point lay, across and along the pinch axis', () => {
    const [a, b] = PINCH.map(pinchRows);
    const changed = a.filter((r) => !r.clamped);
    expect(
      Math.max(...[...changed, ...b.filter((r) => !r.clamped)].map((r) => Math.abs(r.across))),
    ).toBeLessThan(2.2);
    const within = (rows) => rows.filter((r) => !r.clamped && r.zoom !== 30).map((r) => r.along);
    expect(within(a)).toHaveLength(8);
    const all = [...within(a), ...within(b)];
    const gap = Math.max(...within(a).map((x, i) => Math.abs(x - within(b)[i])));
    expect([Math.min(...all), Math.max(...all), gap].map((x) => Math.round(x * 10) / 10)).toEqual([
      34.5, 111.5, 9.3,
    ]);
    expect(section()).toContain(
      'it lay 34.5 to 111.5 px from the midpoint toward the second finger, up to 9.3 px apart',
    );
    const pans = [...a, ...b].filter((r) => r.clamped && r.pan > 0).map((r) => r.pan);
    expect([...new Set(pans)].sort()).toEqual([180, 200]);
    expect(section()).toContain('by 180 or 200 px of the view at zoom 0.1 [O]');
  });
});

describe('the reload record (R-54) and the request starts', () => {
  it('states that the scene, the selection, zoom and scroll survived each reload', () => {
    for (const name of HIT) {
      const p = probes(name);
      expect(strip(p.get('24-after-reload'))).toBe(strip(p.get('24-before-reload')));
      expect(p.get('24-after-reload')).toMatchObject({ selected: 1, zoom: 1.5 });
      expect(p.get('24-after-reload').elements).toHaveLength(3);
      const documents = index(name).network.filter((e) => e.type === 'document');
      expect(documents.map((e) => e.fromServiceWorker === true).sort()).toEqual([false, true]);
    }
    expect(section()).toContain('read the same before and after the reload');
    expect(cells('R-54').map(flat).slice(4, 6)).toEqual(['✅/🟡/✅', '🟡']);
    expect(field(entry('B-30'), 'Confidence')).toContain(
      '[O] high for the mobile reload with a selection',
    );
  });

  it('states that no request started during a touch drag', () => {
    const drawing = evidence('netlog-steps-s17-s21.json').sessions.map((s) => s.drawing);
    for (const d of drawing) expect(d.request_starts.during_drawing).toBe(0);
    const hit = drawing.filter((d) => d.steps.touchDrag === 4);
    expect(seconds(Math.min(...hit.map((d) => d.next_entry_ms.min)))).toBe('15.7');
    expect(section()).toContain('the next entry came 15.7 s or more later');
  });
});
