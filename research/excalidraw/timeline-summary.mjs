// Summarises labelled scene/appState probes from a driver timeline into compact rows:
// label, selected count, active tool, and per-element type/geometry/style facts.
// One scene and one appState read may share a label. When one label is read more than once by
// the same probe, the row keeps the first read's time and the last read's values, so a warning
// naming the label goes to stderr; the summary itself is unchanged. With --points each element
// that has points (a line, an arrow or a freehand stroke) keeps its point count too; the summaries
// committed before the touch-control batch were built without it.
//
// Usage: node research/excalidraw/timeline-summary.mjs <timeline.jsonl> [--since ISO] [--json]
//        [--points]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    since: { type: 'string' },
    json: { type: 'boolean', default: false },
    points: { type: 'boolean', default: false },
  },
});
const [file] = positionals;
if (!file) throw new Error('Pass a timeline.jsonl path.');

const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  // Failed steps carry "error" instead of "result" and are not probe summaries.
  .filter((row) => row.result && row.step.label && (!values.since || row.started >= values.since));

const element = (e) => ({
  type: e.type,
  box: [e.x, e.y, e.width, e.height],
  angle: e.angle,
  groups: e.groups,
  bound: e.bound,
  startBound: e.startBound,
  endBound: e.endBound,
  container: e.container,
  locked: e.locked,
  style: [
    e.strokeColor,
    e.backgroundColor,
    e.fillStyle,
    e.strokeWidth,
    e.strokeStyle,
    e.roughness,
    e.opacity,
    e.roundness,
  ],
  ...(values.points && e.points !== undefined && { points: e.points }),
});

const summary = new Map();
const reads = new Map();
for (const row of rows) {
  const read = `${row.step.do}\u0000${row.step.label}`;
  reads.set(read, (reads.get(read) ?? 0) + 1);
  const entry = summary.get(row.step.label) ?? { label: row.step.label, at: row.started };
  if (row.step.do === 'scene') entry.elements = (row.result.elements ?? []).map(element);
  if (row.step.do === 'appState') {
    const selected = row.result.selected ?? {};
    entry.selected = Object.keys(selected.selectedElementIds ?? {}).length;
    entry.tool = selected.activeTool?.type;
    entry.zoom = selected.zoom?.value;
    entry.scroll = [selected.scrollX, selected.scrollY].map((n) =>
      typeof n === 'number' ? Math.round(n) : n,
    );
    entry.theme = selected.theme;
  }
  summary.set(row.step.label, entry);
}

for (const [read, count] of reads) {
  if (count < 2) continue;
  const [kind, label] = read.split('\u0000');
  process.stderr.write(
    `warning: label "${label}" was read ${String(count)} times by ${kind}; the summary keeps ` +
      "the first read's time and the last read's values.\n",
  );
}

if (values.json) {
  console.log(JSON.stringify([...summary.values()], null, 1));
} else {
  for (const entry of summary.values()) {
    const els = (entry.elements ?? [])
      .map((e) => `${e.type}${JSON.stringify(e.box)}a${e.angle}`)
      .join(' ');
    console.log(
      `${entry.label} | sel=${entry.selected} tool=${entry.tool} zoom=${entry.zoom} scroll=${entry.scroll} | ${els}`,
    );
  }
}
