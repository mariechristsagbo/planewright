// Checks the claims that rest on the committed netlog placement (evidence/netlog-steps.json):
// traffic while the driver drew (R-66) and the step in which the dedicated worker started (R-64).
// Every count, gap and time that the committed summary holds is derived from it, so a claim fails
// if its wording regresses or if the summary changes. The summary does not say which key a key step
// pressed, nor which input came before a wait, so those inputs stay raw-only (limitations.md).
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
const isBeacon = (text) => text.includes('/simple.gif q24');
const beacons = () =>
  sessions()
    .flatMap(written)
    .filter((e) => isBeacon(e.text));
// The placements that hold a session's 24-key beacons, and each beacon's offset in its step.
const beaconSteps = (s) => s.placements.filter((p) => p.entries.some(isBeacon));
const beaconOffsets = (p) => p.entries.filter(isBeacon).map((e) => Number(e.split(' ')[0]));
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
    // The gaps bound when the netlog wrote a request that drawing started, not when it finished.
    expect(network()).toContain(
      `After a drawing step, the next entry came at least ${joined(gaps)}. In s2 and s8–s10 the ` +
        'netlog wrote nothing after the first drawing step. So the netlog wrote any request on ' +
        'any origin that a drawing step started no sooner than that, or never wrote it. It ' +
        'writes a request after the request has finished or failed, and a finished one only ' +
        'after the driver has awaited its response, so a write time is not when the request ' +
        'finished or failed either.',
    );
    expect(network()).not.toMatch(/finished no sooner|did not finish while/u);
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
    // The netlog counts WebSocket frames at a socket's close, and no socket closed.
    const closed = sessions()
      .flatMap(written)
      .filter((e) => e.text.includes(' websocket-close '));
    expect(closed).toHaveLength(0);
    expect(network()).toContain(
      'it counts WebSocket frames only when a socket closes, which neither collaboration socket did.',
    );
  });

  it('place every 24-key beacon outside the drawing steps, with the inputs raw-only', () => {
    expect(beacons().some((e) => DRAWING.has(e.kind))).toBe(false);
    // Sessions with the same count are named together, in index order: "4 in s1 and s6, 1 in s3".
    const bySession = new Map();
    for (const s of sessions().filter((x) => beaconSteps(x).length > 0)) {
      const n = beaconSteps(s).flatMap(beaconOffsets).length;
      bySession.set(n, [...(bySession.get(n) ?? []), short(s)]);
    }
    const split = [...bySession].map(([n, names]) => `${String(n)} in ${joined(names)}`);
    // Measured from the input itself, which the summary holds unless a wait came between them.
    const fromInput = sessions()
      .flatMap(beaconSteps)
      .filter((p) => p.do !== 'wait')
      .flatMap(beaconOffsets);
    expect(beacons().length - fromInput.length).toBe(2);
    expect(network()).toContain(
      `The 24-key beacons ${PLACEMENT}. Each of the ${String(beacons().length)} ` +
        `(${split.join(', ')}) was written ${String(Math.min(...fromInput))}–` +
        `${String(Math.max(...fromInput))} ms after one of five inputs and before the next input`,
    );
    expect(network()).toMatch(/That these inputs send an analytics event is a hypothesis \[H\]/u);
    const raw = flat(read(`${RE}/limitations.md`).split('Facts read only from raw records')[1]);
    expect(raw.split(' - REA MCP denied.')[0]).toContain(
      'and the inputs before the 24-key beacons',
    );
  });
});

describe('the 24-key beacons of the desktop sessions', () => {
  it('came once after each of four inputs in s1 and s6, two of them the export clicks', () => {
    const desktop = sessions().filter(
      (s) => s.session.includes('-desktop') && beaconSteps(s).length > 0,
    );
    expect(desktop.map(short)).toEqual(['s1', 's6']);
    for (const s of desktop) {
      const steps = beaconSteps(s);
      expect(
        steps.map((p) => beaconOffsets(p).length),
        s.session,
      ).toEqual([1, 1, 1, 1]);
      expect(steps.map((p) => p.name ?? p.do).slice(1, 3), s.session).toEqual([
        'Export to PNG',
        'Export to SVG',
      ]);
      // The last follows Ctrl+S, a key step; in s6 a download step ran it in the same millisecond.
      expect(steps[3].do, s.session).toBe('key');
    }
    expect(network()).toContain(
      's1 and s6 each wrote one after each of the four desktop inputs, and none followed a ' +
        'drawing step.',
    );
  });
});

describe('the netlog placement in the research README', () => {
  const readme = () =>
    flat(read('research/excalidraw/README.md')).split('- Netlog placement. ')[1].split(' - ')[0];

  it('orders steps that started in the same millisecond: a trigger before the rows it ran', () => {
    expect(readme()).toContain(
      'Rows that started in the same millisecond keep the order in which their steps started: a ' +
        'step with a trigger comes before the rows of its trigger, which the driver writes ' +
        'before it, and other rows keep their line order.',
    );
  });

  it('reads only the canonical times that the driver writes, which the summary copies', () => {
    expect(readme()).toContain(
      'A missing file, or a line that is not valid JSON or has no time in the canonical form ' +
        'that the driver writes (toISOString, with milliseconds and Z), stops the build and is ' +
        'named, never quoted.',
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
    const idle = sessions()
      .filter((s) => drawn(s) === 0)
      .map(short);
    expect(idle).toEqual(['s4', 's5']);
    expect(doc('limitations.md')).toContain(
      `the netlogs of the sessions that drew, all but ${joined(idle)}, covered drawing. No ` +
        'netlog entry was written during any drawing step',
    );
    expect(doc('limitations.md')).not.toContain('every session covered drawing');
    expect(doc('checkpoint.md')).not.toMatch(/drawing steps for drawing-time traffic \(R-66\)/u);
  });
});

// The placement that holds a session's dedicated-worker event, and the event's offset in it.
const workerStep = (s) => s.placements.find((p) => p.entries.some((e) => / worker /u.test(e)));
const offset = (p, pattern) =>
  p.entries.filter((e) => pattern.test(e)).map((e) => Number(e.split(' ')[0]));
const named = (s, name) => s.placements.find((p) => p.do === 'role' && p.name === name);
const dedicated = () => sessions().filter(workerStep);

describe('the step in which the dedicated worker started (R-64)', () => {
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
});

describe('R-64 and the subset-worker hypothesis', () => {
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
    // The times are an inference; the hypothesis is the trigger.
    const [s] = dedicated();
    const png = seconds(
      Date.parse(workerStep(s).started) - Date.parse(named(s, 'Export to PNG').started),
    );
    expect(row[7]).toContain(
      `both desktop sessions clicked Export to PNG ${png} s before Export to SVG, so the times ` +
        'cannot tell the two exports or the dialog apart, and that the SVG export starts the ' +
        'worker is a hypothesis [H]',
    );
    expect(row[7]).not.toMatch(/dialog apart \[H\]/u);
    expect(row[8]).not.toContain('no live session needed');
    const h6 = network().split(' | N-H6 | ')[1].split(' | N-')[0];
    expect(h6).toContain(
      `its event written during the Export to SVG step in s1 and s6 ${PLACEMENT}`,
    );
    expect(h6).not.toContain('[I]');
    expect(h6).toMatch(/\| low \|/u);
    expect(doc('checkpoint.md')).not.toContain('for the worker trigger (R-64)');
  });
});
