// Builds the sanitized, committable evidence index from external session directories.
// Emits only: screenshot names, SHA-256 digests and PNG dimensions; ARIA snapshot names and
// line counts; labelled scene/appState probe summaries (geometry and style facts); network
// metadata (method, origin, path, query key names, type, status, service-worker flag, counts);
// REA Evidence IDs (MCP records or CLI { ok, data } envelopes)
// and operations; sanitised and redacted failure messages; and captures retired for privacy (name, digest
// and size only, from <session>/retired-captures.json). Screenshots, ARIA text, bundles and
// REA payloads stay outside Git.
//
// Usage: node research/excalidraw/build-evidence.mjs <sessions-root> <output.json> <session...>
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { redactSecrets } from './lib/sanitise.mjs';

const readLines = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

function screenshots(dir) {
  const root = join(dir, 'screenshots');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => {
      const bytes = readFileSync(join(root, name));
      return {
        name,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      };
    });
}

function aria(dir) {
  const root = join(dir, 'aria');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .sort()
    .map((name) => ({ name, lines: readFileSync(join(root, name), 'utf8').split('\n').length }));
}

// The grouping key for one netlog entry: every metadata field, with absent fields as null.
const netKey = (entry) =>
  JSON.stringify(
    ['event', 'method', 'type', 'status', 'origin', 'path', 'queryKeys', 'fromServiceWorker'].map(
      (field) => entry[field] ?? (field === 'origin' ? (entry.scheme ?? null) : null),
    ),
  );

function network(dir) {
  const counts = new Map();
  for (const entry of readLines(join(dir, 'netlog.jsonl'))) {
    const key = netKey({ ...entry, queryKeys: entry.queryKeys ?? [] });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => {
      const [event, method, type, status, origin, path, queryKeys, fromServiceWorker] =
        JSON.parse(key);
      return { event, method, type, status, origin, path, queryKeys, fromServiceWorker, count };
    })
    .sort((a, b) => `${a.origin}${a.path}`.localeCompare(`${b.origin}${b.path}`));
}

function rea(dir) {
  const found = [];
  for (const sub of ['rea', '.']) {
    const root = join(dir, sub);
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)
      .filter((n) => n.endsWith('.json') && n !== 'retired-captures.json')
      .sort()) {
      const text = readFileSync(join(root, name), 'utf8');
      const parsed = JSON.parse(text);
      // REA CLI output wraps one Evidence record as { ok, data }; MCP saves the record itself.
      const head = parsed.data?.evidence_id ? parsed.data : parsed;
      if (head.evidence_id)
        found.push({ file: name, evidence_id: head.evidence_id, operation: head.operation });
      else if (Array.isArray(head.records))
        found.push({ file: name, bundle_records: head.records.length });
    }
  }
  return found;
}

function retired(dir) {
  const file = join(dir, 'retired-captures.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8')).retired.map(
    ({ name, sha256, width, height, reason }) => ({ name, sha256, width, height, reason }),
  );
}

// Groups failed rows by step name, sanitised message and fatal flag. The message is redacted
// again here: timelines written before the driver redacted its error text may still hold a room
// or link value, and this index is committed.
function failureCounts(rows) {
  const failures = new Map();
  for (const row of rows.filter((r) => r.result === undefined)) {
    const error = typeof row.error === 'string' ? redactSecrets(row.error) : (row.error ?? null);
    const key = JSON.stringify([row.step?.do ?? null, error, row.fatal === true]);
    failures.set(key, (failures.get(key) ?? 0) + 1);
  }
  return [...failures].map(([key, count]) => {
    const [step, error, fatal] = JSON.parse(key);
    return { step, error, fatal, count };
  });
}

function steps(dir) {
  const rows = readLines(join(dir, 'timeline.jsonl'));
  const byKind = {};
  for (const row of rows) byKind[row.step.do] = (byKind[row.step.do] ?? 0) + 1;
  const ok = rows.filter((r) => r.result !== undefined);
  return {
    total: rows.length,
    failed: rows.length - ok.length,
    failures: failureCounts(rows),
    first: rows[0]?.started ?? null,
    last: rows.at(-1)?.started ?? null,
    byKind,
    urlShapes: ok.filter((r) => r.step.do === 'url').map((r) => ({ at: r.started, ...r.result })),
    metrics: ok
      .filter((r) => r.step.do === 'metrics' || r.step.do === 'emulate')
      .map((r) => r.result),
  };
}

const [root, output, ...sessions] = process.argv.slice(2);
if (!root || !output || sessions.length === 0) {
  throw new Error('Usage: build-evidence.mjs <sessions-root> <output.json> <session...>');
}
const index = {
  schema: 'planewright-research-evidence/v1',
  generated_by: 'research/excalidraw/build-evidence.mjs',
  sessions: sessions.map((name) => {
    const dir = join(root, name);
    return {
      session: name,
      steps: steps(dir),
      screenshots: screenshots(dir),
      retired_screenshots: retired(dir),
      aria_snapshots: aria(dir),
      network: network(dir),
      rea: rea(dir),
    };
  }),
};
writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${output}`);
