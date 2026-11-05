// Checks the research documents' links and the specific claims that earlier reviews found
// overstated, against the committed evidence and scenario files. Each check fails if the
// withdrawn wording returns or if the evidence it rests on changes.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { countSecretShapes } from '../../lib/sanitise.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RE = join(ROOT, 'docs', 'reverse-engineering');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const doc = (name) => read(`docs/reverse-engineering/${name}`);
const evidence = (name) => JSON.parse(doc(`evidence/${name}`));
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const scenario = (name) => JSON.parse(read(`research/excalidraw/scenarios/${name}.json`));
const entry = (id) =>
  doc('behavior-analysis.md')
    .split(/^### /mu)
    .find((s) => s.startsWith(id));
const field = (text, name) => text.split(`- **${name}:**`)[1].split(/\n- \*\*/u)[0];
const session = (name) => evidence('sessions.json').sessions.find((s) => s.session === name);

const LINKED_DOCS = [
  ...readdirSync(RE)
    .filter((n) => n.endsWith('.md'))
    .map((n) => `docs/reverse-engineering/${n}`),
  'docs/README.md',
  'docs/investigation/1-guest-mode-baseline.md',
  'docs/investigation/README.md',
  'research/excalidraw/README.md',
];

// Every committed research text: documents, evidence, investigation notes, tooling, scenarios,
// fixtures and tests. Tests build their synthetic secret-shaped values at run time.
const SCANNED_TREES = ['docs/reverse-engineering', 'docs/investigation', 'research/excalidraw'];
const SCANNED = /\.(?:md|json|mjs|sh|html|yml|txt)$/u;

// GitHub heading anchors: lower case, punctuation removed, spaces to hyphens, -1 for repeats.
function anchorsOf(markdown) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, heading] of markdown.replace(/```[\s\S]*?```/gu, '').matchAll(/^#+ (.+)$/gmu)) {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
      .replaceAll(' ', '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${String(count)}`);
  }
  return anchors;
}

// Reads a link target once, so nothing is checked first and used later: its text, '' for a
// directory, or null when it does not exist.
function targetText(resolved) {
  try {
    return readFileSync(resolved, 'utf8');
  } catch (error) {
    if (error?.code === 'EISDIR') return '';
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function brokenLinks(path) {
  const text = read(path).replace(/```[\s\S]*?```/gu, '');
  const broken = [];
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/gu)) {
    if (/^[a-z]+:/u.test(target)) continue;
    const [file, anchor] = target.split('#');
    const resolved = file ? join(ROOT, dirname(path), file) : join(ROOT, path);
    const content = targetText(resolved);
    const anchored = anchor && resolved.endsWith('.md');
    if (content === null || (anchored && !anchorsOf(content).has(anchor))) broken.push(target);
  }
  return broken;
}

describe('document structure', () => {
  it.each(LINKED_DOCS)('%s has no broken relative link or anchor', (path) => {
    expect(brokenLinks(path)).toEqual([]);
  });

  it('lists the eleven fields in the introduction in order, as text and not as a list', () => {
    const intro = doc('behavior-analysis.md').split('\nLabels follow')[0];
    expect(intro).not.toMatch(/^\s*\d+\. /mu);
    expect(flat(intro)).toContain(
      'in this order: Initial state, Action, Immediate result, State and related effects, ' +
        'Persistence, Undo/redo, Edge cases, Desktop/mobile, Reproduction, Confidence and ' +
        'Limitations.',
    );
  });

  it.each(SCANNED_TREES)(
    'keeps every research text under %s free of secret-shaped values',
    (tree) => {
      const files = readdirSync(join(ROOT, tree), { recursive: true }).map(String);
      const scanned = files.filter(
        (n) => SCANNED.test(n) && !n.split('/').includes('node_modules'),
      );
      expect(scanned.length).toBeGreaterThan(0);
      for (const name of scanned) {
        expect(countSecretShapes(readFileSync(join(ROOT, tree, name), 'latin1')), name).toEqual({});
      }
      expect(relative(ROOT, RE)).toBe(join('docs', 'reverse-engineering'));
    },
  );
});

const reloads = (name) =>
  scenario(name).steps.filter((s) => s?.do === 'reload' || s?.do === 'goto').length;

describe('persistence claims stay within the observations', () => {
  it('claims no theme or mode across a reload, because nothing reloads after scenario 07', () => {
    for (const name of ['07-dark-theme-desktop', '07b-dark-panel-and-rea-pair-desktop'])
      expect(reloads(name), name).toBe(0);
    for (const name of ['15-element-surfaces-dark-desktop', '08-collaboration-desktop'])
      expect(reloads(name), name).toBe(0);
    expect(reloads('08b-collaboration-stop-attempt')).toBe(0);
    const persistence = field(entry('B-37'), 'Persistence');
    expect(persistence).not.toMatch(/survived/u);
    expect(flat(persistence)).toContain('Not observed (R-19)');
    const backlog = flat(doc('backlog.md'));
    expect(backlog).not.toMatch(/persisted \[O\]|not persisted \[O\]/u);
  });

  it('says that 09b never ran, because no mobile session reloaded', () => {
    for (const name of ['s3-mobile', 's4-dpr-probe', 's7-mobile-fresh']) {
      expect(session(name).steps.byKind.reload ?? 0, name).toBe(0);
    }
    const mobile = flat(field(entry('B-30'), 'Desktop/mobile'));
    expect(mobile).toContain('never ran');
    expect(mobile).not.toContain('asserted layout');
  });

  it('cites only the 00b reload that a scene probe followed', () => {
    const probes = new Map(evidence('probes-s6-desktop-fresh.json').map((p) => [p.label, p]));
    const [before, after] = [probes.get('02-all-shapes'), probes.get('diag-rect-before')];
    expect(after.elements).toEqual(before.elements);
    const state = flat(field(entry('B-30'), 'State and related effects'));
    expect(state).not.toMatch(/every 00b reload/u);
    expect(state).toContain(`the ${String(before.elements.length)}-element scene of 02-all-shapes`);
  });

  it('marks the saved-state keys of the view modes as raw-only', () => {
    const appStateKeys = new Set(
      evidence('probes-s6-desktop-fresh.json')
        .filter((p) => !p.elements)
        .flatMap((p) => Object.keys(p)),
    );
    for (const key of ['zenModeEnabled', 'gridModeEnabled', 'objectsSnapModeEnabled']) {
      expect(appStateKeys.has(key), key).toBe(false);
    }
    expect(entry('B-37')).toMatch(/Key in the saved app state \(raw\)/u);
    expect(flat(doc('limitations.md'))).toContain('the zen, grid, snap and view-mode keys');
  });
});

describe('REA and network claims stay within the committed evidence', () => {
  it('does not place the whole clear inside the scenario 13 network coverage', () => {
    const window = evidence('rea-windows.json').windows.find(
      (w) => w.file === 'r05-inspect-during-13.json',
    );
    expect(Date.parse(window.driver.first_step_at)).toBeLessThan(
      Date.parse(window.network_coverage_started_at),
    );
    const text = flat(doc('rea-findings.md'));
    expect(text).not.toContain('which includes the clear');
    expect(text).toContain(`started at ${window.driver.first_step_at.slice(11, 23)}`);
  });

  it.each([
    ['workbox-expiration', 'workbox-expiration'],
    ['"fonts"', 'the fonts cache'],
    ['0.314', 'the load lifecycle offsets'],
    ['07.053', 'Delete keypress'],
  ])('labels %s as coming from raw records, because no committed file holds it', (needle, said) => {
    for (const name of readdirSync(join(RE, 'evidence'))) {
      expect(readFileSync(join(RE, 'evidence', name), 'utf8'), name).not.toContain(needle);
    }
    const raw = flat(doc('limitations.md')).split('Facts read only from raw records')[1];
    expect(raw.slice(0, 700)).toContain(said);
  });

  it('describes both analytics beacon key sets with their s6 counts', () => {
    const beacons = (name) =>
      session(name).network.filter(
        (e) => e.event === 'request' && e.origin === 'https://queue.simpleanalyticscdn.com',
      );
    const byKeys = new Map();
    for (const e of beacons('s6-desktop-fresh'))
      byKeys.set(e.queryKeys.length, (byKeys.get(e.queryKeys.length) ?? 0) + e.count);
    expect([...byKeys.keys()].sort()).toEqual([23, 24]);
    const total = byKeys.get(23) + byKeys.get(24);
    const text = flat(doc('network-analysis.md'));
    expect(text).toContain(`(${String(byKeys.get(23))} for ${String(byKeys.get(23))} loads)`);
    expect(text).toContain(`${String(byKeys.get(24))} more times in s6 (${String(total)} beacons`);
  });
});

describe('confidence, scope and backlog labels', () => {
  it('uses one confidence rule that never counts two tools as two sessions', () => {
    for (const name of ['methodology.md', 'behavior-analysis.md', 'feature-inventory.md']) {
      expect(flat(doc(name)), name).not.toMatch(/doubly sourced|\(REA and the driver\)\./u);
    }
    // B-31 is high only for the first-load inventory, seen identical in several sessions.
    expect(flat(field(entry('B-31'), 'Confidence'))).toMatch(
      /^ ?\[O\] high for the first-load inventory: identical in five committed inventories \(s1 and s8–s11\), each from a fresh profile[^.]*\. Medium for the stores after interaction/u,
    );
    for (const line of doc('feature-inventory.md').split('\n')) {
      expect(line).not.toMatch(/\[O, high[^\]]*\].*\bs[67] only\b/u);
    }
    expect(flat(doc('feature-inventory.md'))).not.toContain('[O, high], desktop dark in s6');
  });

  it('keeps responsive behaviour partial while only two fixed viewports were seen', () => {
    const row = doc('residual-matrix.md')
      .split('\n')
      .find((line) => line.startsWith('| R-23 |'));
    expect(row).toContain('S-09');
    expect(row.split('|')[5].trim()).toBe('🟡');
    expect(row).toMatch(/breakpoints/u);
    expect(row).toMatch(/orientation/u);
  });

  it('labels backlog criteria no more strongly than their behaviour entries', () => {
    const backlog = flat(doc('backlog.md'));
    const headings = new Set(doc('behavior-analysis.md').match(/^### (B-\d\da?)/gmu));
    for (const [, id] of backlog.matchAll(/\b(B-\d\d)\b/gu)) {
      expect(headings.has(`### ${id}`), id).toBe(true);
    }
    expect(flat(field(entry('B-29'), 'Immediate result'))).toContain('[I]');
    expect(backlog).toMatch(/existed just before is \[I\]/u);
    expect(backlog).toMatch(/returns to Selection is open \(R-02, R-29\)/u);
    expect(backlog).not.toContain('the tool reverts to selection [O]');
  });
});
