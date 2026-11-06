// Checks the research documents against their own structure and the committed evidence, so
// that a claim cannot drift from the generated artefacts it cites.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const doc = (name) => read(`docs/reverse-engineering/${name}`);
const evidence = (name) => JSON.parse(doc(`evidence/${name}`));
const steps = (name) => JSON.parse(read(`research/excalidraw/scenarios/${name}.json`)).steps;
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const probe = (session, label) => evidence(`probes-${session}.json`).find((p) => p.label === label);

const FIELDS = [
  'Initial state',
  'Action',
  'Immediate result',
  'State and related effects',
  'Persistence',
  'Undo/redo',
  'Edge cases',
  'Desktop/mobile',
  'Reproduction',
  'Confidence',
  'Limitations',
];

const behaviourEntries = () =>
  doc('behavior-analysis.md')
    .split(/^### /mu)
    .filter((section) => section.startsWith('B-'));

const matrixRows = () =>
  doc('residual-matrix.md')
    .split('\n')
    .filter((line) => /^\| R-\d\d \|/u.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

const ids = (text, prefix) => new Set(text.match(new RegExp(`\\b${prefix}-\\d\\d\\b`, 'gu')));
// The entry IDs a text names, with runs such as "B-10 to B-12" expanded.
function entriesNamed(text) {
  const named = new Set(text.match(/\bB-\d\da?\b/gu));
  for (const [, from, to] of text.matchAll(/\bB-(\d\d) to B-(\d\d)\b/gu)) {
    for (let n = Number(from); n <= Number(to); n += 1)
      named.add(`B-${String(n).padStart(2, '0')}`);
  }
  return named;
}
// Top-level field bullets of an entry, each with its text up to the next field bullet.
const fieldsOf = (entry) =>
  entry
    .split(/\n- \*\*/u)
    .slice(1)
    .map((chunk) => {
      const at = chunk.indexOf(':**');
      return { name: chunk.slice(0, at), content: chunk.slice(at + 3).trim() };
    })
    .filter((field) => FIELDS.includes(field.name));
const section = (text, heading) => text.split(heading)[1].split(/^## /mu)[0];

describe('behaviour entries', () => {
  it('give every entry the eleven issue #1 fields once each, in order, each with content', () => {
    const entries = behaviourEntries();
    // B-01 to B-49 and B-28a; a lost or duplicated heading changes the count.
    expect(entries.map((e) => e.slice(0, 6).trim())).toHaveLength(50);
    for (const entry of entries) {
      const fields = fieldsOf(entry);
      expect(
        fields.map((f) => f.name),
        entry.slice(0, 5),
      ).toEqual(FIELDS);
      for (const { name, content } of fields) {
        expect(content.length, `${entry.slice(0, 5)} ${name}`).toBeGreaterThan(3);
      }
    }
  });

  it('give a reason for every "not applicable" dimension', () => {
    for (const entry of behaviourEntries()) {
      for (const { name, content } of fieldsOf(entry)) {
        if (!/not applicable/iu.test(content)) continue;
        expect(content, `${entry.slice(0, 5)} ${name}`).toMatch(/not applicable \([^)]{8,}\)/iu);
      }
    }
  });

  it('cite, for every unobserved undo dimension, rows that plan undo and are listed in R-52', () => {
    const rows = new Map(matrixRows().map((row) => [row[0], row]));
    const listed = entriesNamed(rows.get('R-52').join(' '));
    for (const entry of behaviourEntries()) {
      const id = entry.match(/^B-\d\da?/u)[0];
      const undo = fieldsOf(entry).find((f) => f.name === 'Undo/redo').content;
      if (!undo.includes('Not observed')) continue;
      expect(listed.has(id), `R-52 lists ${id}`).toBe(true);
      for (const ref of ids(undo, 'R')) {
        expect(`${rows.get(ref)[6]} ${rows.get(ref)[7]}`, `${id} cites ${ref}`).toMatch(/undo/iu);
      }
    }
  });

  it('tie every unobserved dimension to an existing residual row', () => {
    const known = new Set(matrixRows().map((row) => row[0]));
    for (const entry of behaviourEntries()) {
      for (const bullet of entry.split(/\n- \*\*/u).filter((b) => b.includes('Not observed'))) {
        const refs = [...ids(bullet, 'R')];
        expect(refs.length, `${entry.slice(0, 5)}: ${bullet.slice(0, 40)}`).toBeGreaterThan(0);
        for (const ref of refs) expect(known.has(ref), ref).toBe(true);
      }
    }
  });
});

describe('residual matrix', () => {
  it('fills every cell of every row with a known status', () => {
    for (const row of matrixRows()) {
      expect(row, row[0]).toHaveLength(9);
      for (const cell of row) expect(cell, row[0]).not.toBe('');
      expect(['✅', '🟡', '❌', '⛔'], row[0]).toContain(row[4]);
    }
  });

  it('has a row for every issue #1 scope item', () => {
    const defined = ids(section(doc('residual-matrix.md'), '## Issue #1 included scope'), 'S');
    expect(defined.size).toBe(43);
    const covered = new Set(matrixRows().flatMap((row) => [...ids(row[2], 'S')]));
    for (const id of defined) expect(covered.has(id), id).toBe(true);
  });

  it('has a row for every feature-inventory entry', () => {
    const inventory = doc('feature-inventory.md');
    const index = section(inventory, '## Inventory IDs');
    const entries = new Set(
      index
        .split('\n')
        .filter((line) => /^\| F-\d\d/u.test(line))
        .map((line) => line.split('|')[3].trim()),
    );
    for (const heading of ['## 1. Desktop shell', '## 2. Secondary surfaces']) {
      const rows = section(inventory, heading)
        .split('\n')
        .filter((l) => l.startsWith('| '));
      for (const line of rows.slice(2)) expect(entries.has(line.split('|')[1].trim())).toBe(true);
    }
    const covered = new Set(matrixRows().flatMap((row) => [...ids(row[2], 'F')]));
    for (const id of ids(index, 'F')) expect(covered.has(id), id).toBe(true);
  });
});

// The read time and label always differ between sessions; every other field must match.
const strip = (p) => JSON.stringify({ ...p, at: undefined, label: undefined });

function compare(later, earlier) {
  const byLabel = new Map(earlier.map((p) => [p.label, p]));
  const shared = later.filter((p) => byLabel.has(p.label));
  const same = shared.filter((p) => strip(p) === strip(byLabel.get(p.label)));
  return { shared: shared.length, same: same.length };
}

describe('cited numbers match the committed evidence', () => {
  it('cross-session replay counts', () => {
    const [s1, s2, s3, s6, s7] = ['s1-desktop', 's2-desktop-fresh', 's3-mobile']
      .concat(['s6-desktop-fresh', 's7-mobile-fresh'])
      .map((s) => evidence(`probes-${s}.json`));
    const text = flat(doc('behavior-analysis.md'));
    const a = compare(s6, s1);
    const b = compare(s6, s2);
    const c = compare(s7, s3);
    const earlier = new Set([...s1, ...s2].map((q) => q.label));
    const either = s6.filter((p) => earlier.has(p.label));
    expect(text).toContain(
      `s6 shares ${a.shared} probe labels with s1, and ${a.same} of ${a.shared}`,
    );
    expect(text).toContain(`s6 shares ${b.shared} labels with s2, and ${b.same} of ${b.shared}`);
    expect(text).toContain(`s7 shares ${c.shared} labels with s3, and ${c.same} of ${c.shared}`);
    expect(text).toContain(`${either.length} of the ${s6.length} s6 labels`);
  });

  it('local save timing', () => {
    const offsets = { t100: [], t200: [], t300: [] };
    for (const trial of ['13a', '13b', '13c']) {
      const t0 = probe('s6-desktop-fresh', `${trial}-t0`);
      const final = probe('s6-desktop-fresh', `${trial}-t1500`).elements.length;
      for (const key of Object.keys(offsets)) {
        const p = probe('s6-desktop-fresh', `${trial}-${key}`);
        offsets[key].push(Date.parse(p.at) - Date.parse(t0.at));
        expect(p.elements.length, `${trial}-${key}`).toBe(key === 't300' ? final : final - 1);
      }
    }
    const range = (list) => `${Math.min(...list)}–${Math.max(...list)}`;
    const text = flat(doc('behavior-analysis.md'));
    expect(text).toContain(`absent at 0, ${range(offsets.t100)} and ${range(offsets.t200)} ms`);
    expect(text).toContain(`present at ${range(offsets.t300)} ms and later, in 3 of 3 trials`);
  });

  it('REA windows and what they retain', () => {
    const windows = evidence('rea-windows.json').windows;
    const text = flat(doc('rea-findings.md'));
    for (const w of windows.filter((x) => x.session !== 's1-desktop')) {
      expect(text).toContain(`${w.window.start.slice(11, 23)}–${w.window.end.slice(11, 23)}`);
      if (w.operation === 'observe_web_session') expect(w).not.toHaveProperty('network_requests');
    }
    const inspect = windows.find((w) => w.file === 'r05-inspect-during-13.json');
    expect(inspect).toMatchObject({ network_requests: 0, websocket_connections: 0 });
    expect(inspect.console_events).toBe(0);
    expect(inspect.allowed_origins).toEqual(['https://excalidraw.com']);
    expect(text).toContain('0 requests, 0 WebSocket connections and 0 console events');
    expect(text).toContain('retains navigation and lifecycle metadata only');
    const mobile = windows.find((w) => w.file === 'r02-observe-during-10.json');
    const lead = Date.parse(mobile.window.start) - Date.parse(mobile.driver.previous_step.at);
    expect(text).toContain(`Armed ${lead} ms after scenario 10's first tap`);
    expect(text).toContain(`remaining ${mobile.driver.steps} steps`);
    const desktop = windows.find((w) => w.file === 'r02-observe-during-02.json');
    expect(text).toContain(`All ${desktop.driver.steps} steps of scenario 02`);
  });
});

describe('cited geometry matches the committed evidence', () => {
  it('arrow ends and binding flags', () => {
    const arrowOf = (label) =>
      probe('s6-desktop-fresh', label).elements.find((e) => e.type === 'arrow');
    const drawn = arrowOf('02-all-shapes');
    const drag = steps('02-shapes-desktop').find((s) => s.do === 'drag' && s.from[0] === 425);
    expect([drawn.startBound, drawn.endBound]).toEqual([true, true]);
    expect(drawn.box[0] + drawn.box[2]).toBe(drag.to[0] - 1);
    const bound = arrowOf('04-arrow-bound');
    expect([bound.startBound, bound.endBound]).toEqual([false, true]);
    expect(flat(doc('behavior-analysis.md'))).toContain('its ends are at x=426 and x=514');
  });

  it('image drop and paste centres', () => {
    const image = probe('s6-desktop-fresh', '06b-image-drop').elements.at(-1);
    expect([image.box[0] + image.box[2] / 2, image.box[1] + image.box[3] / 2]).toEqual([910, 155]);
    const pasted = probe('s6-desktop-fresh', '06-paste').elements.slice(4);
    const original = probe('s6-desktop-fresh', '06-undo-paste').elements;
    const [dx, dy] = [pasted[0].box[0] - original[0].box[0], pasted[0].box[1] - original[0].box[1]];
    const arrowEnd = steps('04-styles-binding-desktop').find((s) => s.from?.[0] === 535).to;
    const centre = [(340 + arrowEnd[0]) / 2 + dx, (arrowEnd[1] + 450) / 2 + dy];
    const pointer = steps('06-clipboard-io-persistence-desktop').find((s) => s.do === 'move').at;
    expect(centre).toEqual([pointer[0] - 90, pointer[1] - 45]);
    expect(flat(doc('behavior-analysis.md'))).toContain(`(${centre[0]},${centre[1]})`);
  });

  it('Ctrl+wheel was probed at the viewport centre', () => {
    const wheel = steps('05-pan-zoom-view-desktop').find((s) => s.modifiers?.includes('Control'));
    expect(wheel.at).toEqual([640, 360]);
    const scene = (p) => [640 / p.zoom - p.scroll[0], 360 / p.zoom - p.scroll[1]];
    for (const session of ['s1-desktop', 's6-desktop-fresh']) {
      const before = scene(probe(session, '05-shift-wheel-200'));
      const after = scene(probe(session, '05-ctrl-wheel-up-100'));
      for (const axis of [0, 1]) expect(Math.abs(after[axis] - before[axis])).toBeLessThan(1);
    }
    expect(flat(doc('behavior-analysis.md'))).toContain('Pointer anchoring is not established');
  });
});

describe('cited network counts match the committed evidence', () => {
  it('service-worker and source-map counts', () => {
    const count = (session, test) =>
      evidence('sessions.json')
        .sessions.find((s) => s.session === session)
        .network.filter((e) => e.event === 'request' && test(e))
        .reduce((sum, e) => sum + e.count, 0);
    const origin = (sw) => (e) =>
      e.origin === 'https://excalidraw.com' && e.fromServiceWorker === sw;
    const fresh = evidence('sessions.json')
      .sessions.map((s) => s.session)
      .filter((s) => s !== 's1-desktop');
    expect(fresh).toHaveLength(10);
    const usual = count('s2-desktop-fresh', origin(false));
    const other = fresh.filter((s) => count(s, origin(false)) !== usual);
    expect(other, 'one count for each of s2–s10').toEqual(['s11-mobile-r76-14']);
    // s11's extra request is one page fetch, not from the service worker.
    const extra = count('s11-mobile-r76-14', (e) => origin(false)(e) && e.type === 'fetch');
    expect(count('s11-mobile-r76-14', origin(false))).toBe(usual + extra);
    expect(extra).toBe(1);
    const sw = count('s6-desktop-fresh', origin(true));
    const s1 = count('s1-desktop', origin(true));
    expect(count('s1-desktop', origin(false))).toBe(0);
    const text = flat(doc('network-analysis.md'));
    expect(text).toContain(
      `${usual} requests with fromServiceWorker: false in each of s2–s10; s11 had ${usual + extra}`,
    );
    expect(text).toContain(`${sw} true in s6; all ${s1} of s1's requests to this origin`);
    expect(text).toContain(`also had ${count('s11-mobile-r76-14', origin(true))} true`);
    for (const s of evidence('sessions.json').sessions) {
      expect(count(s.session, (e) => (e.path ?? '').endsWith('.map'))).toBe(0);
    }
  });
});
