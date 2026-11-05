// Checks the claims that rest on the committed netlog placement (evidence/netlog-steps.json):
// traffic while the driver drew (R-66) and the step in which the dedicated worker started (R-64).
// Every count, gap and time is derived from the committed summary, so a claim fails if its wording
// regresses or if the summary changes.
import { describe, expect, it } from 'vitest';

import { RE, cells, doc, evidence, flat, read, scenario } from './r76-evidence.mjs';

const PLACEMENT = '[I, raw netlog and timeline times]';
const DRAWING = new Set(['drag', 'path', 'touchDrag']);
const sessions = () => evidence('netlog-steps.json').sessions;
const short = (s) => s.session.split('-')[0];
const drawn = (s) => Object.values(s.drawing.steps).reduce((sum, n) => sum + n, 0);
const sum = (list) => list.reduce((total, s) => total + drawn(s), 0);
// The sessions before and after the R-76 runs, by their index order.
const early = () => sessions().slice(0, 7);
const r76 = () => sessions().slice(7);
// "a, b and c", as the documents join a list.
const joined = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const seconds = (ms) => (ms / 1000).toFixed(1);
const clock = (t) => new Date(t).toISOString().slice(11, 19);
const network = () => doc('network-analysis.md');

// The entries of one placement with the time the driver wrote each, and the kind of its step.
const timed = (p) =>
  p.entries.map((text) => ({
    text,
    kind: p.do,
    at: Date.parse(p.started) + Number(text.split(' ')[0]),
  }));
const written = (s) => s.placements.flatMap(timed);
const socketOpened = (s) => written(s).find((e) => e.text.includes(' websocket-open '))?.at;
const beacons = () =>
  sessions()
    .flatMap(written)
    .filter((e) => e.text.includes('/simple.gif q24'));
// The shortest time from a drawing step to the next entry, over the sessions of a platform.
const shortest = (platform) =>
  seconds(
    Math.min(
      ...sessions()
        .filter((s) => s.session.includes(platform) && s.drawing.next_entry_ms !== null)
        .map((s) => s.drawing.next_entry_ms.min),
    ),
  );

describe('the drawing steps set against the netlog (R-66)', () => {
  it('rest on the committed placement, in which no entry was written during a drawing step', () => {
    for (const s of sessions()) expect(s.drawing.entries_during, s.session).toBe(0);
    const counts = early()
      .filter(drawn)
      .map((s) => `${short(s)} ${String(drawn(s))}`);
    const idle = early()
      .filter((s) => drawn(s) === 0)
      .map(short);
    expect(network()).toContain(
      `Every drawing step, every origin ${PLACEMENT}. A drawing step is a drag, path or ` +
        "touchDrag, from its start to the next step's start.",
    );
    expect(network()).toContain(
      `In s1–s7 there were ${String(sum(early()))} (${joined(counts)}; ${joined(idle)} drew ` +
        `nothing), and with s8–s11 ${String(sum(sessions()))}`,
    );
    expect(network()).toContain('No netlog entry was written during any of them.');
    expect(network()).not.toContain('For s1–s7 it has not been done (R-66)');
  });

  it('give the shortest time to the next entry, and the sessions with no later entry', () => {
    const gaps = sessions()
      .filter((s) => s.drawing.next_entry_ms !== null)
      .map((s) => `${seconds(s.drawing.next_entry_ms.min)} s in ${short(s)}`);
    gaps[0] = gaps[0].replace(' s in ', ' s later in ');
    const none = sessions()
      .filter((s) => drawn(s) > 0 && s.drawing.without_later_entry === drawn(s))
      .map(short);
    expect(none).toEqual(['s2', 's8', 's9', 's10']);
    expect(network()).toContain(
      `After a drawing step, the next entry came at least ${joined(gaps)}.`,
    );
    expect(network()).toContain(
      'In s2 and s8–s10 the netlog wrote nothing after the first drawing step.',
    );
    expect(network()).toMatch(/cannot be told from the netlog \[U\]/u);
  });
});

describe('the collaboration rooms and the 24-key beacons against the drawing steps', () => {
  it('say that no drawing step ran in a collaboration room', () => {
    const rooms = sessions().filter((s) => socketOpened(s) !== undefined);
    expect(rooms.map(short)).toEqual(['s1', 's6']);
    const lastDrawn = rooms.map((s) => Date.parse(s.drawing.last_started));
    const opened = rooms.map(socketOpened);
    expect(lastDrawn.every((t, k) => t < opened[k])).toBe(true);
    expect(network()).toContain(
      'No drawing step ran after a collaboration socket opened: s1 and s6 last drew at ' +
        `${joined(lastDrawn.map(clock))} UTC, and their sockets opened at ` +
        `${joined(opened.map(clock))} UTC.`,
    );
  });

  it('place every 24-key beacon outside the drawing steps, with the inputs raw-only', () => {
    expect(beacons().some((e) => DRAWING.has(e.kind))).toBe(false);
    expect(network()).toContain(
      `The 24-key beacons ${PLACEMENT}. Each of the ${String(beacons().length)}`,
    );
    expect(network()).toMatch(/That these inputs send an analytics event is a hypothesis \[H\]/u);
    const raw = flat(read(`${RE}/limitations.md`).split('Facts read only from raw records')[1]);
    expect(raw.split(' - REA MCP denied.')[0]).toContain(
      'and the inputs before the 24-key beacons',
    );
  });
});

describe('R-66 and the other documents', () => {
  it('cite the placement for every session and keep the row partial', () => {
    const row = cells('R-66').map(flat);
    expect(row[5]).toBe('🟡');
    expect(row[6]).toContain(
      `nor during any of the ${String(sum(early()))} drawing steps of s1–s7 ${PLACEMENT}`,
    );
    expect(row[7]).toContain(
      `the next entry came ${shortest('-mobile')} s or more after a drawing step on mobile and ` +
        `${shortest('-desktop')} s or more on desktop`,
    );
    expect(row[7]).toContain('no drawing ran in a collaboration room');
    expect(row[8]).not.toMatch(/s1–s7 netlog/u);
    expect(sum(r76())).toBeGreaterThan(0);
  });

  it('no longer say that the netlog was not set against the drawing steps', () => {
    expect(doc('rea-findings.md')).not.toContain('that has not been done');
    expect(doc('rea-findings.md')).toContain('set against every drawing step of s1–s11');
    expect(doc('limitations.md')).toContain(
      'the netlog of every session covered drawing. No netlog entry was written during any ' +
        'drawing step',
    );
    expect(doc('checkpoint.md')).not.toMatch(/drawing steps for drawing-time traffic \(R-66\)/u);
  });
});

// The placement that holds a session's dedicated-worker event, and the event's offset in it.
const workerStep = (s) => s.placements.find((p) => p.entries.some((e) => / worker /u.test(e)));
const offset = (p, pattern) =>
  p.entries.filter((e) => pattern.test(e)).map((e) => Number(e.split(' ')[0]));
const named = (s, name) => s.placements.find((p) => p.do === 'role' && p.name === name);

describe('the step in which the dedicated worker started (R-64)', () => {
  const dedicated = () => sessions().filter(workerStep);

  it('is the Export to SVG click in both sessions, between two fetches of both chunks', () => {
    expect(dedicated().map(short)).toEqual(['s1', 's6']);
    const ms = [];
    for (const s of dedicated()) {
      const p = workerStep(s);
      expect([p.do, p.name], s.session).toEqual(['role', 'Export to SVG']);
      const [at] = offset(p, / worker /u);
      ms.push(at);
      for (const chunk of [/subset-worker\.chunk-/u, /subset-shared\.chunk-/u]) {
        const fetched = offset(p, new RegExp(` request script 200 \\S+${chunk.source}`, 'u'));
        expect(fetched.some((t) => t < at) && fetched.some((t) => t > at), s.session).toBe(true);
      }
    }
    expect(network()).toContain(
      'In both sessions its event was written during the step that clicks Export to SVG in the ' +
        `Export image dialog, ${String(ms[0])} ms (s1) and ${String(ms[1])} ms (s6) after that step ` +
        'started, after the netlog wrote both chunks and before it wrote both again ' +
        `${PLACEMENT}.`,
    );
  });

  it('cannot be told from the Export to PNG click before it, so the trigger stays a hypothesis', () => {
    const before = dedicated().map(
      (s) => Date.parse(workerStep(s).started) - Date.parse(named(s, 'Export to PNG').started),
    );
    expect(new Set(before.map(seconds)).size).toBe(1);
    expect(network()).toContain(
      `Both sessions clicked Export to PNG ${seconds(before[0])} s before, in the same dialog, ` +
        'and wrote no worker event then.',
    );
    expect(network()).toMatch(/that the SVG export starts the worker is a hypothesis \[H\]/u);
    expect(network()).not.toContain('Which action triggered it was not isolated');
    const mobile = ['09', '10', '10b', '11', '14', '16'].map((id) => JSON.stringify(scenario(id)));
    expect(mobile.some((text) => text.includes('Export to SVG'))).toBe(false);
    expect(network()).toContain('No mobile scenario clicks Export to SVG.');
  });

  it('is cited by R-64, whose trigger stays open, and by the subset-worker hypothesis', () => {
    const row = cells('R-64').map(flat);
    expect(row[5]).toBe('🟡');
    const [s1, s6] = sessions()
      .filter(workerStep)
      .map((s) => offset(workerStep(s), / worker /u)[0]);
    expect(row[6]).toContain(
      `written during the step that clicks Export to SVG in both, ${String(s1)} and ` +
        `${String(s6)} ms after it started ${PLACEMENT}`,
    );
    expect(row[7]).toContain('no mobile scenario clicks Export to SVG');
    expect(row[7]).toMatch(/cannot tell the two exports or the dialog apart \[H\]/u);
    expect(row[8]).not.toContain('no live session needed');
    const h6 = network().split(' | N-H6 | ')[1].split(' | N-')[0];
    expect(h6).toContain('its event written during the Export to SVG step in s1 and s6 [I]');
    expect(h6).toMatch(/\| low \|/u);
    expect(doc('checkpoint.md')).not.toContain('for the worker trigger (R-64)');
  });
});
