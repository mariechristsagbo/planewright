// Checks the claims that the review of 79fc538 found inconsistent or unguarded, against the
// methodology and the committed evidence.
import { describe, expect, it } from 'vitest';

import { cells, doc, evidence, flat } from './r76-evidence.mjs';

// Placing a netlog request in a scenario sets the netlog's request times against the timeline's
// step times, so it is an inference from two raw records, never an observation of its own.
const PLACEMENT = '[I, raw netlog and timeline times]';
// Every evidence label in a flattened text that rests on raw netlog or timeline times.
const timingLabels = (text) =>
  [...text.matchAll(/\[[OISHU][^\][]*\]/gu)]
    .map(([label]) => label)
    .filter((label) => /netlog|\btimes\b|raw log/u.test(label));

describe('the netlog placement label', () => {
  it('is defined once in the methodology', () => {
    expect(doc('methodology.md')).toContain(
      'Placing a netlog request in a scenario sets its start time against the step times of ' +
        `the timeline, so it is labelled ${PLACEMENT}`,
    );
  });

  it('is the only label of the placements in the network analysis', () => {
    const text = doc('network-analysis.md');
    const labels = timingLabels(text);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    for (const label of labels) expect(label).toBe(PLACEMENT);
    expect(text).toContain(`started during scenario 10, not with the load ${PLACEMENT}`);
    expect(text).toContain(
      `and one, to https://queue.simpleanalyticscdn.com, during 14 ${PLACEMENT}`,
    );
    expect(text).toContain(`s11's requests after its load ${PLACEMENT}`);
  });

  it('is the label that R-64 and R-66 cite for the same placements', () => {
    for (const id of ['R-64', 'R-66']) {
      const row = cells(id).map(flat);
      expect(row[6], id).toContain(PLACEMENT);
      for (const label of timingLabels(row.join(' | '))) expect(label, id).toBe(PLACEMENT);
      expect(row.join(' | '), id).not.toContain('(raw log)');
    }
  });
});

// "a, b and c", as the documents join a list.
const joined = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const sessions = () => evidence('sessions.json').sessions;
const short = (s) => s.session.split('-')[0];
const workerEvents = (s) => s.network.filter((e) => e.event === 'worker').length;
const servedByWorker = (s) =>
  s.network.filter((e) => e.event === 'request' && e.fromServiceWorker === true).length;

describe("R-64's mobile column", () => {
  it('is partial: the service worker served requests on mobile, a dedicated worker never ran', () => {
    const mobile = sessions().filter((s) => s.session.includes('-mobile'));
    // A dedicated worker on mobile would call for another rating, not this wording.
    expect(mobile.filter(workerEvents).map(short)).toEqual([]);
    const served = mobile.filter(servedByWorker).map(short);
    expect(served.length).toBeGreaterThan(0);
    const dedicated = sessions().filter(workerEvents).map(short);
    const row = cells('R-64').map(flat);
    expect(row[4].split('/')[2]).toBe('🟡');
    expect(row[6]).toContain(
      `A dedicated worker from the subset-worker chunk (netlog worker event, ${joined(dedicated)})`,
    );
    expect(row[6]).toContain(`On mobile, the service worker served requests in ${joined(served)}`);
    expect(row[7]).toContain(
      'No mobile netlog has a dedicated worker event, so the mobile column rests on the service ' +
        'worker alone',
    );
    expect(doc('network-analysis.md')).toContain(
      `(netlog worker event, ${joined(dedicated)} only; no mobile netlog has one)`,
    );
  });
});

describe('commit ranges in the checkpoint', () => {
  // Every A..B range of the checkpoint, as [A, B].
  const ranges = () =>
    [...doc('checkpoint.md').matchAll(/\b([0-9a-f]{7})\.\.([0-9a-f]{7})\b/gu)].map(([, a, b]) => [
      a,
      b,
    ]);

  it('follow the Git notation that the checkpoint states', () => {
    expect(doc('checkpoint.md')).toContain(
      'Commit ranges are written as Git reads them: A..B is the commits after A up to and ' +
        'including B. A span that includes its first commit is written from A to B.',
    );
    expect(doc('checkpoint.md')).toContain('The 23 commits from 0587fac to 626e849');
  });

  it('start at the same commit wherever they end at the same commit', () => {
    const starts = new Map();
    for (const [a, b] of ranges()) starts.set(b, [...new Set([...(starts.get(b) ?? []), a])]);
    expect(starts.size).toBeGreaterThan(1);
    for (const [end, list] of starts) expect(list, end).toHaveLength(1);
    expect(starts.get('f1562ed')).toEqual(['935f2fc']);
  });
});
