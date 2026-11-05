// Checks the claims that the review of f1562ed found stale, overstated or unguarded, against the
// committed evidence: each expectation is derived from the evidence index, so a claim fails if
// its wording regresses or if the evidence it rests on changes.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RE, ROOT, doc, evidence } from './r76-evidence.mjs';

describe('the page-load count', () => {
  const loads = () =>
    evidence('sessions.json').sessions.reduce(
      (sum, s) => sum + (s.steps.byKind.goto ?? 0) + (s.steps.byKind.reload ?? 0),
      0,
    );

  // Every "page-load count (N)" a research document states, as [document, phrase, N].
  const statedIn = (name) =>
    [...doc(name).matchAll(/page-load count \((\d+)\)/gu)].map(([said, n]) => [name, said, n]);

  it('is the committed count wherever a document states it', () => {
    const names = readdirSync(join(ROOT, RE)).filter((name) => name.endsWith('.md'));
    const stated = names.flatMap(statedIn);
    expect(stated.length).toBeGreaterThan(0);
    for (const [name, said, n] of stated) expect(Number(n), `${name}: ${said}`).toBe(loads());
  });
});
