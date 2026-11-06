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
// Evidence files committed after d992fc0, by the final mobile batch (s83–s84).
export const COMMITTED_AFTER_D992FC0 = [
  'netlog-steps-s83-s84.json',
  ...['s83-mobile-final-batch', 's84-mobile-final-batch-2'].map((name) => `probes-${name}.json`),
  'rea-windows-s83-s84.json',
  'sessions-s83-s84.json',
];
// Evidence files committed after 82b93e8, by the menu items, tools and clipboard batch (s79–s82)
// and later.
export const COMMITTED_AFTER_82B93E8 = [
  ...COMMITTED_AFTER_D992FC0,
  'netlog-steps-s79-s82.json',
  ...[
    's79-mobile-menu-items-clipboard',
    's80-mobile-menu-items-clipboard-2',
    's81-mobile-flip-arrow-grid',
    's82-mobile-flip-arrow-grid-2',
  ].map((name) => `probes-${name}.json`),
  ...['app-root', 'static-canvas', 'html', 'body'].map(
    (k) => `rea-listeners-s82-${k}.summary.json`,
  ),
  'rea-windows-s79-s82.json',
  'sessions-s79-s82.json',
];
// Evidence files committed after 74977c3, by the context-menu, tools and snap batch (s74–s78)
// and later.
export const COMMITTED_AFTER_74977C3 = [
  ...COMMITTED_AFTER_82B93E8,
  'netlog-steps-s74-s78.json',
  ...[
    's74-mobile-context-tools',
    's75-mobile-context-items',
    's76-mobile-context-items-2',
    's77-mobile-paste-styles',
    's78-mobile-paste-styles-2',
  ].map((name) => `probes-${name}.json`),
  'rea-listeners-s76.summary.json',
  ...['s74', 's75', 's76'].map((short) => `rea-screenshot-${short}.summary.json`),
  'rea-windows-s74-s78.json',
  'sessions-s74-s78.json',
];
// Evidence files committed after 97149aa, by the preferences, modes and eraser batch (s71–s73)
// and later.
export const COMMITTED_AFTER_97149AA = [
  ...COMMITTED_AFTER_74977C3,
  'netlog-steps-s71-s73.json',
  ...[
    's71-mobile-preferences-eraser',
    's72-mobile-preferences-eraser-2',
    's73-mobile-eraser-bound',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s71-s73.json',
  'sessions-s71-s73.json',
];
// Evidence files committed after 5d2126b, by the library undo, offline and language batch (s68–s70)
// and later.
export const COMMITTED_AFTER_5D2126B = [
  ...COMMITTED_AFTER_97149AA,
  'netlog-steps-s68-s70.json',
  ...[
    's68-mobile-library-undo-offline',
    's69-mobile-library-undo-offline-2',
    's70-mobile-language-2',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s68-s70.json',
  'sessions-s68-s70.json',
];
// Evidence files committed after 61c695a, by the replay batch (s65–s67) and later.
export const COMMITTED_AFTER_61C695A = [
  ...COMMITTED_AFTER_5D2126B,
  'netlog-steps-s65-s67.json',
  ...[
    's65-mobile-keyboard-resize-3',
    's66-mobile-library-background-2',
    's67-mobile-library-sidebar-2',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s65-s67.json',
  'sessions-s65-s67.json',
];
// Evidence files committed after d81dc03, by the keyboard, offline and layout batch (s58–s64) and
// later; s58 ran no labelled probe, so it has no probe summary.
export const COMMITTED_AFTER_D81DC03 = [
  ...COMMITTED_AFTER_61C695A,
  'netlog-steps-s58-s64.json',
  ...[
    's59-mobile-keyboard-resize',
    's60-mobile-offline',
    's61-mobile-find-language-library',
    's62-mobile-keyboard-resize-2',
    's63-mobile-offline-2',
    's64-mobile-find-library',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s58-s64.json',
  'sessions-s58-s64.json',
];
// Evidence files committed after 2a6ec57, by the mobile radio and edit batch (s51–s57) and later;
// s51 ran no labelled probe, so it has no probe summary.
export const COMMITTED_AFTER_2A6EC57 = [
  ...COMMITTED_AFTER_D81DC03,
  'netlog-steps-s51-s57.json',
  ...[
    's52-mobile-export-link',
    's53-mobile-radios-autoshape',
    's54-mobile-edits-link',
    's55-mobile-radios-points',
    's56-mobile-edits-link-2',
    's57-mobile-radios-points-2',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s51-s57.json',
  'sessions-s51-s57.json',
];
// Evidence files committed after 7e547de, by the mobile control batch (s37–s50) and later; s50 ran
// no labelled probe, so it has no probe summary.
export const COMMITTED_AFTER_7E547DE = [
  ...COMMITTED_AFTER_2A6EC57,
  'netlog-steps-s37-s50.json',
  ...[
    's37-mobile-inventory-2',
    's38-mobile-handles-3',
    's39-mobile-shapes-align',
    's40-mobile-arrow-types',
    's41-mobile-colours',
    's42-mobile-handles-4',
    's43-mobile-shapes-align-2',
    's44-mobile-arrow-types-2',
    's45-mobile-colours-2',
    's46-mobile-text-controls',
    's47-mobile-text-controls-2',
    's48-mobile-mermaid-undo',
    's49-mobile-mermaid-generate',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s37-s50.json',
  'sessions-s37-s50.json',
];
// Evidence files committed after 823dae7, by the mobile touch-control batch (s22–s36) and later.
export const COMMITTED_AFTER_823DAE7 = [
  ...COMMITTED_AFTER_7E547DE,
  'netlog-steps-s22-s36.json',
  ...[
    's22-mobile-popovers',
    's23-mobile-arrow-binding',
    's24-mobile-handles',
    's25-mobile-actions',
    's26-mobile-styles',
    's27-mobile-line-taps',
    's28-mobile-arrow-binding-2',
    's29-mobile-handles-2',
    's30-mobile-actions-2',
    's31-mobile-styles-2',
    's32-mobile-line-taps-2',
    's33-mobile-distribute',
    's34-mobile-fill-line',
    's35-mobile-distribute-2',
    's36-mobile-fill-line-2',
  ].map((name) => `probes-${name}.json`),
  'rea-windows-s22-s36.json',
  'sessions-s22-s36.json',
];
// Evidence files committed after a4990b6, by the mobile priority-1 batch (s17–s21) and later.
export const COMMITTED_AFTER_A4990B6 = [
  ...COMMITTED_AFTER_823DAE7,
  'netlog-steps-s17-s21.json',
  'probes-s17-mobile-hit-reload.json',
  'probes-s18-mobile-pinch.json',
  'probes-s19-mobile-hit-reload-2.json',
  'probes-s20-mobile-pinch-2.json',
  'probes-s21-mobile-hit-reload-3.json',
  'rea-windows-s17-s21.json',
  'sessions-s17-s21.json',
];
// Evidence files committed after 2864145, by the mobile follow-up (s15, s16) and the batch after it.
export const COMMITTED_AFTER_2864145 = [
  'netlog-steps-s15-s16.json',
  'probes-s15-mobile-svg-only.json',
  'probes-s16-mobile-generation-reload.json',
  'rea-windows-s15-s16.json',
  'sessions-s15-s16.json',
  ...COMMITTED_AFTER_A4990B6,
];
// Evidence files committed after db16323, by the observation batch and the mobile follow-up.
// Records written before then count the files that existed when they were written.
export const COMMITTED_AFTER_DB16323 = [
  'netlog-steps-s12-s14.json',
  'probes-s12-mobile-draw-rea.json',
  'rea-windows-s12-s14.json',
  'sessions-s12-s14.json',
  ...COMMITTED_AFTER_2864145,
];
export const COMMITTED_AFTER_6D5D264 = ['netlog-steps.json', ...COMMITTED_AFTER_DB16323];
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
