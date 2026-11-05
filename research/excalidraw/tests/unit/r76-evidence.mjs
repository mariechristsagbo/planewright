// Shared reads of the committed R-76 evidence (sessions s8–s11) for the documentation checks in
// documentation-r76.test.mjs, documentation-r76-surfaces.test.mjs,
// documentation-r76-build.test.mjs and documentation-tenth-review.test.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const read = (path) => readFileSync(join(ROOT, path), 'utf8');
export const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
export const RE = 'docs/reverse-engineering';
export const doc = (name) => flat(read(`${RE}/${name}`));
export const evidence = (name) => JSON.parse(read(`${RE}/evidence/${name}`));
export const session = (name) => evidence('sessions.json').sessions.find((s) => s.session === name);
// Evidence files committed after the twelfth-review remediation (6d5d264). The regeneration
// records of the tenth to twelfth reviews cover only the files committed before them.
export const COMMITTED_AFTER_6D5D264 = ['netlog-steps.json'];
const DIR = 'research/excalidraw/scenarios';
const FILES = readdirSync(join(ROOT, DIR)).map((file) => file.replace(/\.json$/u, ''));
export const scenario = (id) => {
  const name = FILES.find((file) => file.startsWith(`${id}-`));
  return { name, ...JSON.parse(read(`${DIR}/${name}.json`)) };
};

// The R-76 sessions, the short name their README row uses and the scenario REA observed.
export const R76 = [
  { name: 's8-desktop-r76-12', short: 's8', observed: '12' },
  { name: 's9-desktop-r76-13', short: 's9', observed: '13' },
  { name: 's10-desktop-r76-15', short: 's10', observed: '15' },
  { name: 's11-mobile-r76-14', short: 's11', observed: '14' },
];

// The scenario ids of a session's row in the README order table.
export const order = (short) => {
  const row = read('research/excalidraw/README.md')
    .split('\n')
    .find((line) => line.includes(`(\`${short}\`)`));
  return row.split('|')[2].trim().split(' → ');
};
export const tally = (steps) => {
  const out = {};
  for (const step of steps) out[step.do] = (out[step.do] ?? 0) + 1;
  return out;
};
export const ms = (from, to) => Date.parse(to) - Date.parse(from);
export const probes = (name) => evidence(`probes-${name}.json`);
export const probe = (name, label) => probes(name).find((p) => p.label === label);
export const entry = (id) =>
  read(`${RE}/behavior-analysis.md`)
    .split(/^### /mu)
    .find((section) => section.startsWith(id));
export const field = (text, name) =>
  flat(text.split(`- **${name}:**`)[1].split(/\n- \*\*/u)[0]).trim();
// The read time and label always differ between sessions; every other field must match.
export const strip = (p) => JSON.stringify({ ...p, at: undefined, label: undefined });
export const differing = (later, earlier) => {
  const byLabel = new Map(probes(earlier).map((p) => [p.label, p]));
  const shared = probes(later).filter((p) => byLabel.has(p.label));
  const labels = shared.filter((p) => strip(p) !== strip(byLabel.get(p.label))).map((p) => p.label);
  return { shared: shared.length, labels };
};
export const cells = (id) =>
  read(`${RE}/residual-matrix.md`)
    .split('\n')
    .find((line) => line.startsWith(`| ${id} |`))
    .split('|')
    .map((cell) => cell.trim());
export const range = (list) => `${String(Math.min(...list))}–${String(Math.max(...list))}`;
export const lines = (name, file) =>
  session(name).aria_snapshots.find((a) => a.name === file)?.lines;
export const digests = (name) => new Map(session(name).screenshots.map((s) => [s.name, s.sha256]));
