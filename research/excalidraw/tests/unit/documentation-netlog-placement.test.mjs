// Checks the claims that rest on the committed netlog placement (evidence/netlog-steps.json):
// traffic while the driver drew (R-66). Every count, gap and time is derived from the committed
// summary, so a claim fails if its wording regresses or if the summary changes.
import { describe, expect, it } from 'vitest';

import { RE, cells, doc, evidence, flat, read } from './r76-evidence.mjs';

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
