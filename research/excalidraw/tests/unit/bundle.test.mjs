// Unit tests for the Evidence bundle layout (lib/bundle.mjs): records in Evidence ID order,
// manifests derived from them without duplicates, and refusals. Synthetic records only; REA's own
// importer, not this module, checks that an Evidence ID matches its record.
import { describe, expect, it } from 'vitest';

import { bundleOf } from '../../lib/bundle.mjs';

// Low-entropy synthetic IDs built at run time.
const id = (digit) => `ev_${'0'.repeat(63)}${digit}`;
const provider = { id: 'rea-cdp-browser', name: 'Observation', version: '2' };
const environment = {
  id: 'Chrome/1.0',
  platform: 'unknown',
  architecture: 'unknown',
  isolation: 'none',
};
const record = (digit, extra = {}) => ({
  evidence_id: id(digit),
  subject: null,
  provider,
  analysis_profile: null,
  predicate_type: 'rea.web-page-inspection',
  operation: 'inspect_web_page',
  parameters: {},
  raw_result: null,
  normalized_result: {},
  confidence: 'observed',
  authority: 'external-service',
  environment,
  limitations: [],
  relationship_coverage: null,
  locations: [],
  evidence_links: [],
  ...extra,
});

describe('bundleOf', () => {
  it('orders records by Evidence ID and lists each provider and environment once', () => {
    const other = { id: 'rea-web-script-export', name: 'Export', version: '1' };
    const bundle = bundleOf([record(3), record(1, { provider: other }), record(2)]);
    expect(bundle.records.map((r) => r.evidence_id)).toEqual([id(1), id(2), id(3)]);
    expect(bundle.providers).toEqual([provider, other]);
    expect(bundle.environments).toEqual([environment]);
    expect(bundle.artifacts).toEqual([]);
    expect(bundle.scenarios).toEqual([]);
    expect(bundle.captures).toEqual([]);
    expect(bundle.unknowns).toEqual([]);
  });

  it('derives artifact, scenario and capture manifests the way REA does', () => {
    const subject = { digest: { sha256: 'f'.repeat(64) }, format: 'file', architecture: null };
    const bundle = bundleOf([
      record(2, { subject: { ...subject, extra: 'dropped' } }),
      record(1, { authority: 'controlled-replay', operation: 'capture_browser_scenario' }),
      record(3, { predicate_type: 'rea.process-capture', environment: null }),
    ]);
    expect(bundle.artifacts).toEqual([subject]);
    expect(bundle.scenarios).toEqual([
      { evidence_id: id(1), operation: 'capture_browser_scenario', authority: 'controlled-replay' },
    ]);
    expect(bundle.captures).toEqual([
      { evidence_id: id(3), predicate_type: 'rea.process-capture' },
    ]);
    expect(bundle.environments).toEqual([environment]);
  });

  it('never changes a record', () => {
    const input = record(1);
    const copy = structuredClone(input);
    expect(bundleOf([input]).records[0]).toEqual(copy);
  });
});

describe('bundleOf refusals', () => {
  it('refuses an empty list', () => {
    expect(() => bundleOf([])).toThrow(/^A bundle needs at least one Evidence record\.$/u);
  });

  it('refuses a record without a well-formed Evidence ID', () => {
    expect(() => bundleOf([record(1), { ...record(2), evidence_id: 'ev-test' }])).toThrow(
      /^Record 2 has no well-formed Evidence ID\.$/u,
    );
  });

  it('refuses the same Evidence ID twice', () => {
    expect(() => bundleOf([record(1), record(2), record(1)])).toThrow(
      /^Record 3 repeats an Evidence ID\.$/u,
    );
  });
});
