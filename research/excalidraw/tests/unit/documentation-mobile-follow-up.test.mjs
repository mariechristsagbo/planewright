// Checks the record of the mobile follow-up (s15, s16) against its committed evidence: the screen
// orientation read after each load, the REA windows, the mobile Export to SVG without a worker,
// the request start times, the reload of scenario 24 and the second run of scenario 22.
import { describe, expect, it } from 'vitest';

import { cells, doc, evidence, flat, read } from './r76-evidence.mjs';

const RE = 'docs/reverse-engineering';
const section = () =>
  flat(read(`${RE}/checkpoint.md`).split('## Mobile follow-up (s15–s16)\n')[1].split(/^## /mu)[0]);
const index = (prefix) =>
  evidence('sessions-s15-s16.json').sessions.find((s) => s.session.startsWith(`${prefix}-`));
const placement = (prefix) =>
  evidence('netlog-steps-s15-s16.json').sessions.find((s) => s.session.startsWith(`${prefix}-`));
const probe = (file, label) => evidence(file).find((p) => p.label === label);
const S16 = 'probes-s16-mobile-generation-reload.json';
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
const events = (s, name) =>
  s.network.filter((e) => e.event === name).reduce((sum, e) => sum + (e.count ?? 1), 0);

describe('the sessions and REA windows of the mobile follow-up', () => {
  it('state the metrics that every read after a load gave, the orientation included', () => {
    for (const prefix of ['s15', 's16']) {
      const reads = index(prefix).steps.metrics;
      expect(reads.length).toBeGreaterThan(1);
      for (const m of reads) {
        expect([m.orientationType, m.orientationAngle, m.devicePixelRatio]).toEqual([
          'portrait-primary',
          0,
          3,
        ]);
        expect([m.screenWidth, m.screenHeight, m.maxTouchPoints, m.coarsePointer]).toEqual([
          390,
          844,
          5,
          true,
        ]);
      }
      for (const m of reads.filter((r) => r.canvases.length > 0)) {
        expect([m.innerWidth, m.innerHeight]).toEqual([390, 844]);
        for (const c of m.canvases) expect([c.width, c.height]).toEqual([1170, 2532]);
      }
    }
    expect(section()).toContain(
      'After each load every metrics read gave 390×844 CSS px, DPR 3, a 390×844 portrait-primary ' +
        'screen at angle 0, 5 touch points, a coarse pointer and canvases of 1170×2532',
    );
  });

  it('state how early each window armed and that each kept what the netlog started', () => {
    const wins = evidence('rea-windows-s15-s16.json').windows;
    const lead = (w) => seconds(Date.parse(w.driver.first_step_at) - Date.parse(w.window.start));
    expect(wins.map((w) => w.file)).toEqual([
      'r02-inspect-during-19.json',
      'r02-inspect-during-10.json',
      'r03-inspect-during-22.json',
    ]);
    for (const w of wins) expect(w.allowed_origins).toHaveLength(7);
    const [w19, w10, w22] = wins;
    expect(section()).toContain(
      `armed ${lead(w19)} s before 19 in s15 and ${lead(w10)} and ${lead(w22)} s before 10 and 22`,
    );
    expect(events(index('s16'), 'request-failed')).toBe(2);
    expect(section()).toContain(
      `Each kept as many requests as the netlog started inside it: ${String(w19.network_requests)}, ` +
        `${String(w10.network_requests)} and ${String(w22.network_requests)}, 2 of them aborted.`,
    );
    expect(section()).toContain('The window armed before 24 returned no Evidence');
    expect(doc('rea-findings.md')).toContain('cannot span a navigation');
  });
});

describe('the observations of the mobile follow-up', () => {
  it('R-64: s15 clicked Export to SVG once, failed only its download and wrote no worker', () => {
    const s15 = index('s15');
    expect(s15.steps.failures).toEqual([expect.objectContaining({ step: 'download', count: 1 })]);
    expect(events(s15, 'worker')).toBe(0);
    expect(section()).toContain('the netlog has no worker event');
    expect(cells('R-64').map(flat)[5]).toBe('🟡');
  });

  it('R-66: no request start fell in a touch drag, with the gap after drawing', () => {
    const [a, b] = ['s15', 's16'].map((p) => placement(p).drawing);
    expect([a.request_starts.during_drawing, b.request_starts.during_drawing]).toEqual([0, 0]);
    expect(section()).toContain(
      `None of the ${String(a.request_starts.known)} request starts of s15 and the ` +
        `${String(b.request_starts.known)} of s16 fell while a touch drag ` +
        `(${String(a.steps.touchDrag)} and ${String(b.steps.touchDrag)}) was the latest step to ` +
        `start; the next entry came ${seconds(a.next_entry_ms.min)} s and ` +
        `${seconds(b.next_entry_ms.min)} s or more after a drawing step`,
    );
  });

  it('R-54: the stored scene and app state read the same across the reload of 24', () => {
    const strip = (p) =>
      Object.fromEntries(Object.entries(p).filter(([key]) => !['at', 'label'].includes(key)));
    const [before, after] = ['24-before-reload', '24-after-reload'].map((l) => probe(S16, l));
    expect(strip(after)).toEqual(strip(before));
    expect(before.elements).toHaveLength(22);
    expect([before.theme, before.selected]).toEqual(['dark', 0]);
    const documents = index('s16').network.filter((e) => e.type === 'document');
    expect(documents.map((e) => e.fromServiceWorker === true).sort()).toEqual([false, true]);
    expect(section()).toContain("The reload's document came from the service worker");
    expect(section()).toContain('read the same before and after');
    // The mobile column became ✅ with the reloads of a selection at zoom 1.5 in s17, s19 and s21.
    expect(cells('R-54').map(flat)[4]).toBe('✅/🟡/✅');
  });

  it('R-63: the second insert matches s12 but for a shift in x, and the tool is the same', () => {
    const elements = (file) => probe(file, '22-mermaid-inserted').elements;
    const [old, now] = [elements('probes-s12-mobile-draw-rea.json'), elements(S16)];
    expect(now).toHaveLength(old.length);
    const shifts = new Set();
    now.forEach((e, i) => {
      const { box, ...rest } = e;
      const { box: was, ...before } = old[i];
      expect(rest).toEqual(before);
      expect(box.slice(1)).toEqual(was.slice(1));
      if (box[0] !== was[0]) shifts.add(Math.round((box[0] - was[0]) * 10) / 10);
    });
    expect([...shifts]).toEqual([-3.4]);
    expect(section()).toContain("Every inserted element's x is 3.4 smaller than in s12");
    expect(probe(S16, '22-wireframe').tool).toBe('magicframe');
    const row = cells('R-63').map(flat);
    expect([row[4], row[5]]).toEqual(['❌/❌/🟡', '🟡']);
    expect(row[8]).not.toMatch(/second/u);
  });
});
