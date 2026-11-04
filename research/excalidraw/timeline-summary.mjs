// Summarises labelled scene/appState probes from a driver timeline into compact rows:
// label, selected count, active tool, and per-element type/geometry/style facts.
//
// Usage: node research/excalidraw/timeline-summary.mjs <timeline.jsonl> [--since ISO] [--json]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { since: { type: 'string' }, json: { type: 'boolean', default: false } },
});
const [file] = positionals;
if (!file) throw new Error('Pass a timeline.jsonl path.');

const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((row) => row.step.label && (!values.since || row.started >= values.since));

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
});

const summary = new Map();
for (const row of rows) {
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
