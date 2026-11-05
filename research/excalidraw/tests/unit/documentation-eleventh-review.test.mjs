// Checks the claims that the review of 79fc538 found inconsistent or unguarded, against the
// methodology and the committed evidence.
import { describe, expect, it } from 'vitest';

import { cells, doc, flat } from './r76-evidence.mjs';

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
