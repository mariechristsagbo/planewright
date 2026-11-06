// Lays REA Evidence records out as the canonical Evidence bundle that REA's importer checks, as
// the pinned build derives it (src/domain/evidenceBundle.ts, createEvidenceBundle): records in
// Evidence ID order, and artifact, provider and environment manifests taken from them once each,
// in the order of their JSON text. Records are copied as they are; this module never computes or
// changes an Evidence ID, so only REA's own import can tell whether a bundle is valid.

const EVIDENCE_ID = /^ev_[a-f0-9]{64}$/u;

// Unicode code point order, as REA sorts; it equals plain string order for the ASCII it reads.
function compare(left, right) {
  const [a, b] = [Array.from(left), Array.from(right)];
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const d = a[i].codePointAt(0) - b[i].codePointAt(0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

function uniqueSorted(values) {
  const byText = new Map(values.map((value) => [JSON.stringify(value), value]));
  return [...byText.keys()].sort(compare).map((text) => byText.get(text));
}

function checkIds(records) {
  if (records.length === 0) throw new Error('A bundle needs at least one Evidence record.');
  const seen = new Set();
  records.forEach((record, index) => {
    const id = record?.evidence_id;
    if (typeof id !== 'string' || !EVIDENCE_ID.test(id)) {
      throw new Error(`Record ${String(index + 1)} has no well-formed Evidence ID.`);
    }
    if (seen.has(id)) throw new Error(`Record ${String(index + 1)} repeats an Evidence ID.`);
    seen.add(id);
  });
}

const artifactOf = ({ digest, format, architecture }) => ({ digest, format, architecture });

/** The canonical bundle of a list of Evidence records. */
export function bundleOf(records) {
  checkIds(records);
  const sorted = [...records].sort((a, b) => compare(a.evidence_id, b.evidence_id));
  return {
    artifacts: uniqueSorted(sorted.flatMap((r) => (r.subject ? [artifactOf(r.subject)] : []))),
    providers: uniqueSorted(sorted.map((r) => r.provider)),
    environments: uniqueSorted(sorted.flatMap((r) => (r.environment ? [r.environment] : []))),
    scenarios: sorted
      .filter((r) => r.authority === 'controlled-replay')
      .map(({ evidence_id, operation, authority }) => ({ evidence_id, operation, authority })),
    captures: sorted
      .filter((r) => r.predicate_type === 'rea.process-capture')
      .map(({ evidence_id, predicate_type }) => ({ evidence_id, predicate_type })),
    unknowns: [],
    records: sorted,
  };
}
