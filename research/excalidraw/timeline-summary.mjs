// Summarises labelled scene/appState probes from a driver timeline into compact rows:
// label, selected count, active tool, and per-element type/geometry/style facts.
// One scene and one appState read may share a label. When one label is read more than once by
// the same probe, the row keeps the first read's time and the last read's values, so a warning
// naming the label goes to stderr; the summary itself is unchanged. With --points each element
// that has points (a line, an arrow or a freehand stroke) keeps its point count too; the summaries
// committed before the touch-control batch were built without it. An arrow whose probe read its
// elbowed flag keeps it; the scene probe reads it only in sessions run after s37, so the earlier
// timelines, and the summaries built from them, have none. In the same way an element keeps its
// link shape and a freehand stroke its pressure flag, pressure count and stroke options, which the
// probe reads only from s51 on. With --text a text element keeps its font size, family and
// alignment; the summaries committed before s51 were built without it. The focus, connectivity and
// layout probes and the app state's canvas background are read only from s59 on, so the earlier
// summaries have none of their rows or keys: a focus row keeps the focused element and each live
// region's role, politeness and length, never its text, and a layout row leaves out the app root's
// class. With --modes an app-state row keeps the stored mode flags it read and the tool lock;
// the probe reads the binding, midpoint, selection-mode and input flags only from s71 on, and the
// summaries committed before s71 were built without it.
//
// Usage: node research/excalidraw/timeline-summary.mjs <timeline.jsonl> [--since ISO] [--json]
//        [--points] [--text] [--modes]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    since: { type: 'string' },
    json: { type: 'boolean', default: false },
    points: { type: 'boolean', default: false },
    text: { type: 'boolean', default: false },
    modes: { type: 'boolean', default: false },
  },
});
const [file] = positionals;
if (!file) throw new Error('Pass a timeline.jsonl path.');

// Rows of the probes that only the sessions of s59 on ran.
const VIEW = {
  focus: (r) => ({
    focused: r.focused,
    live: (r.live ?? []).map(({ role, live, chars }) => ({ role, live, chars })),
  }),
  connectivity: (r) => ({ connectivity: r }),
  layout: (r) => ({
    layout: { viewport: r.viewport, lang: r.lang, dir: r.dir, buttons: r.buttons },
  }),
};

// Rows come from the probes only: a step such as selectOption names an option in its own label
// field, which is not a probe label. Before s59 only scene and appState reads had labels.
const PROBES = new Set(['scene', 'appState', ...Object.keys(VIEW)]);

const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  // Failed steps carry "error" instead of "result" and are not probe summaries.
  .filter((row) => row.result && row.step.label && (!values.since || row.started >= values.since))
  .filter((row) => PROBES.has(row.step.do));

// Fields that only the probes of later sessions read, each kept when its probe read it.
const LATER = ['elbowed', 'link', 'simulatePressure', 'pressures', 'strokeOptions'];
const later = (e) =>
  Object.fromEntries(LATER.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));

// Summary names of the stored mode flags; a flag the probe did not read is left out.
const MODES = {
  grid: 'gridModeEnabled',
  zen: 'zenModeEnabled',
  view: 'viewModeEnabled',
  snap: 'objectsSnapModeEnabled',
  binding: 'isBindingEnabled',
  midpointSnap: 'isMidpointSnappingEnabled',
  boxSelection: 'boxSelectionMode',
  input: 'inputDevice',
};
function modesOf(selected) {
  const modes = Object.fromEntries(
    Object.entries(MODES)
      .filter(([, key]) => selected[key] !== undefined)
      .map(([name, key]) => [name, selected[key]]),
  );
  const locked = selected.activeTool?.locked;
  return typeof locked === 'boolean' ? { ...modes, toolLocked: locked } : modes;
}

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
  ...(values.text && e.fontSize !== undefined && { font: [e.fontSize, e.fontFamily, e.textAlign] }),
  ...later(e),
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
    if (selected.viewBackgroundColor !== undefined) entry.background = selected.viewBackgroundColor;
    if (values.modes) entry.modes = modesOf(selected);
  }
  if (Object.hasOwn(VIEW, row.step.do)) Object.assign(entry, VIEW[row.step.do](row.result));
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
