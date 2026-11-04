// Builds the sanitized, committable evidence index from external session directories.
// Emits only: screenshot names, SHA-256 digests and PNG dimensions; ARIA snapshot names and
// line counts; labelled scene/appState probe summaries (geometry and style facts); network
// metadata (method, origin, path, query key names, type, status, counts); REA Evidence IDs
// and operations. Screenshots, ARIA text, bundles and REA payloads stay outside Git.
//
// Usage: node research/excalidraw/build-evidence.mjs <sessions-root> <output.json> <session...>
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function network(dir) {
  const counts = new Map();
  for (const entry of readLines(join(dir, 'netlog.jsonl'))) {
    const key = JSON.stringify([
      entry.event,
      entry.method ?? null,
      entry.type ?? null,
      entry.status ?? null,
      entry.origin ?? entry.scheme ?? null,
      entry.path ?? null,
      entry.queryKeys ?? [],
    ]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => {
      const [event, method, type, status, origin, path, queryKeys] = JSON.parse(key);
      return { event, method, type, status, origin, path, queryKeys, count };
    })
    .sort((a, b) => `${a.origin}${a.path}`.localeCompare(`${b.origin}${b.path}`));
}

function rea(dir) {
  const found = [];
  for (const sub of ['rea', '.']) {
    const root = join(dir, sub);
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)
      .filter((n) => n.endsWith('.json'))
      .sort()) {
      const text = readFileSync(join(root, name), 'utf8');
      const head = JSON.parse(text);
      if (head.evidence_id)
        found.push({ file: name, evidence_id: head.evidence_id, operation: head.operation });
      else if (Array.isArray(head.records))
        found.push({ file: name, bundle_records: head.records.length });
    }
  }
  return found;
}

function steps(dir) {
  const rows = readLines(join(dir, 'timeline.jsonl'));
  const byKind = {};
  for (const row of rows) byKind[row.step.do] = (byKind[row.step.do] ?? 0) + 1;
  const ok = rows.filter((r) => r.result !== undefined);
  return {
    total: rows.length,
    failed: rows.length - ok.length,
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
      aria_snapshots: aria(dir),
      network: network(dir),
      rea: rea(dir),
    };
  }),
};
writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${output}`);
