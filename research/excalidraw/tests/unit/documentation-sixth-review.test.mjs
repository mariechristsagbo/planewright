// Checks the claims that the review of 46b2b01 found overstated, unlabelled or untraceable,
// against the committed evidence, scenarios, scripts and residual matrix. Each check fails if
// the corrected wording regresses or if the evidence it rests on changes.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const RE = 'docs/reverse-engineering';
const doc = (name) => flat(read(`${RE}/${name}`));
const evidence = (name) => JSON.parse(read(`${RE}/evidence/${name}`));
const committed = () =>
  readdirSync(join(ROOT, RE, 'evidence'))
    .map((name) => read(`${RE}/evidence/${name}`))
    .join('\n');
const probe = (name, label) => evidence(`probes-${name}.json`).find((p) => p.label === label);
const session = (name) => evidence('sessions.json').sessions.find((s) => s.session === name);
const entry = (id) =>
  read(`${RE}/behavior-analysis.md`)
    .split(/^### /mu)
    .find((section) => section.startsWith(id));
const field = (text, name) => flat(text.split(`- **${name}:**`)[1].split(/\n- \*\*/u)[0]);
const item = (title) =>
  flat(
    read(`${RE}/backlog.md`)
      .split(/\n(?=\d+\. \*\*)/u)
      .find((part) => part.includes(`**${title}.**`)),
  );
const cells = (id) =>
  read(`${RE}/residual-matrix.md`)
    .split('\n')
    .find((line) => line.startsWith(`| ${id} |`))
    .split('|')
    .map((cell) => cell.trim());
const SCENARIOS = 'research/excalidraw/scenarios';
const scenarios = () =>
  readdirSync(join(ROOT, SCENARIOS)).map((name) => ({
    name: name.replace(/\.json$/u, ''),
    steps: JSON.parse(read(`${SCENARIOS}/${name}`)).steps,
  }));
describe('backlog labels and their evidence', () => {
  it('say that paste selected 2 of the 3 copies, as both probes recorded', () => {
    for (const name of ['s1-desktop', 's6-desktop-fresh']) {
      expect(probe(name, '06-paste').selected, name).toBe(2);
    }
    expect(field(entry('B-26'), 'Immediate result')).toContain('2 selected');
    expect(item('Clipboard')).not.toMatch(/selects them \[O\]/u);
    expect(item('Clipboard')).toContain('2 of the 3 copies selected [O]');
  });

  it('name only the Control modifier, because no scenario pressed Meta', () => {
    for (const { name, steps } of scenarios())
      expect(JSON.stringify(steps), name).not.toContain('Meta');
    const viewport = item('Infinite canvas viewport');
    expect(viewport).not.toContain('Ctrl/Cmd');
    expect(viewport).toMatch(/Cmd[^.]*\bopen\b/u);
  });

  it('keep the raw-only view-mode inference raw-only in the backlog', () => {
    expect(field(entry('B-37'), 'Persistence')).toContain('probably not saved [I, raw only]');
    expect(item('Themes and view modes')).toContain('probably not saved [I, raw only]');
  });

  it('treat what the excalidraw-theme key stores as an inference', () => {
    const { storage } = evidence('rea-inspect-initial.summary.json');
    expect(storage.local_storage_keys).toContain('excalidraw-theme');
    expect(storage.values_redacted).toBe(true);
    for (const text of [item('Themes and view modes'), field(entry('B-37'), 'Persistence')]) {
      expect(text).toMatch(/excalidraw-theme[^.]*already present at the first[^.]*\[I\]/u);
      expect(text).not.toMatch(/excalidraw-theme key\)? \[O\]/u);
    }
  });

  it('label the explanation of the early 02-tool-probe reads as a hypothesis', () => {
    for (const text of [
      item('Shape creation tools'),
      field(entry('B-01'), 'State and related effects'),
    ]) {
      expect(text).toContain('before it caught up is [H]');
    }
    expect(item('Shape creation tools')).toMatch(
      /disagree between s2 and s6 \[O, raw timelines only\]/u,
    );
  });

  it('claim in the checkpoint only what was compared', () => {
    const text = doc('checkpoint.md');
    expect(text).not.toContain(
      'criteria are labelled no more strongly than their behaviour entries',
    );
    expect(text).toContain('not audited exhaustively against their entries');
  });
});

describe('raw-only facts', () => {
  // The bullet of limitations.md that lists them, up to the next top-level bullet.
  const rawOnly = () =>
    flat(
      read(`${RE}/limitations.md`)
        .split('Facts read only from raw records')[1]
        .split(/\n- \*\*/u)[0],
    );

  it('end the raw-only list at its own bullet', () => {
    expect(rawOnly()).toContain('02-tool-probe');
    expect(rawOnly()).not.toContain('REA MCP denied');
  });

  it('include the storage quota, which no committed file holds', () => {
    expect(committed()).not.toMatch(/quota/iu);
    expect(doc('network-analysis.md')).toMatch(/644 MB quota \[O, raw REA record only\]/u);
    expect(rawOnly()).toContain('2.5 MB of a 644 MB quota');
    expect(doc('checkpoint.md')).not.toContain('only the storage names are raw-only');
  });

  it('include the REA side of the byte-identical screenshot pairs', () => {
    const table = read(`${RE}/rea-findings.md`).split('## 2. Cross-driver')[1].split(/^## /mu)[0];
    const pairs = table
      .split('\n')
      .filter((line) => line.startsWith('|') && line.includes('byte-identical'));
    expect(pairs).toHaveLength(3);
    for (const line of pairs) {
      const digest = line.match(/`([0-9a-f]{12})`/u)[1];
      expect(read(`${RE}/evidence/sessions.json`), digest).toContain(digest);
      expect(line).toContain('REA digest raw only');
    }
    expect(rawOnly()).toContain('the REA PNG digests behind the three byte-identical pairs');
  });

  it('include the REA result sizes', () => {
    expect(doc('rea-findings.md')).toMatch(/84–91 KB \[O, raw only\]/u);
    expect(rawOnly()).toContain('84–91 KB');
    expect(doc('rea-findings.md')).not.toContain('Three facts are not in it');
  });
});

describe('how the newer driver controls were verified', () => {
  it('say stub-based tests only, because the local checks never reach those controls', () => {
    const selftest = read('research/excalidraw/selftest.sh');
    expect(selftest).not.toMatch(/runLast|driver-state|rea-extract|#room=/u);
    expect(read('research/excalidraw/isolation-check.sh')).not.toMatch(/runLast|rea-extract/u);
    const text = doc('methodology.md');
    expect(text).not.toContain(
      'covered by stub-based tests, the local self-test and the isolation check',
    );
    expect(text).toContain(
      'Controls added after the review of cb11dff (untested in a live session; stub-based tests only',
    );
    expect(text).toContain('Controls added after the review of 46b2b01 (stub-based tests only');
  });
});

describe('the checkpoint on commit messages', () => {
  it('does not say that every fifth-review commit message names its failing test', () => {
    const text = doc('checkpoint.md');
    expect(text).not.toContain('each commit message says which');
    expect(text).toContain('0587fac, 73bb550 and ddc61f6 do not name it');
  });
});

describe('remaining observation work', () => {
  const remaining = () =>
    read(`${RE}/checkpoint.md`).split('## Remaining observation work')[1].split(/^## /mu)[0];
  const idsOf = (text) =>
    [...text.matchAll(/R-(\d\d)(?:–R-(\d\d))?/gu)].flatMap(([, a, b = a]) =>
      Array.from(
        { length: Number(b) - Number(a) + 1 },
        (_, i) => `R-${String(Number(a) + i).padStart(2, '0')}`,
      ),
    );
  const bullet = (label) =>
    flat(
      remaining()
        .split(/\n- /u)
        .find((part) => part.startsWith(`**${label}`)),
    );

  it.each(['1', '2'])('lists under priority %s only rows of that priority', (p) => {
    const ids = idsOf(bullet(`New live observation, priority ${p}:`));
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(cells(id)[9], id).toBe(p);
  });

  it('plans the second fresh-profile runs in a row of their own', () => {
    const text = bullet('Second fresh-profile runs:');
    expect(idsOf(text)).toEqual(['R-76']);
    const [, , , , , status, , , next] = cells('R-76');
    expect(status).toBe('🟡');
    expect(next).toMatch(/12, 13, 14 and 15/u);
    expect(next).toMatch(/storage inventory/u);
    expect(next).toMatch(/initial-page inspection/u);
  });
});

describe('architecture confidences', () => {
  const hypothesis = (id) =>
    read(`${RE}/architecture-hypotheses.md`)
      .split('\n')
      .find((line) => line.startsWith(`| ${id} `))
      .split('|')
      .map((cell) => flat(cell).trim());

  it('do not rate a z-order that no layer command showed', () => {
    expect(cells('R-50')[5]).toBe('❌');
    const [, , statement, , confidence] = hypothesis('A-02');
    expect(statement).not.toContain('z-ordered');
    expect(statement).toContain('(R-50)');
    expect(confidence).toMatch(/^high for the flat array/u);
  });

  it('do not claim an offline start that was never attempted', () => {
    expect(cells('R-57')[5]).toBe('❌');
    const [, , statement] = hypothesis('A-07');
    expect(statement).not.toContain('for offline start');
    expect(statement).toContain('(R-57)');
  });

  it('mark the font id as raw-only, because no committed file holds it', () => {
    expect(committed()).not.toContain('fontFamily');
    const [, , , , confidence, basis] = hypothesis('A-13');
    expect(basis).toContain('raw timelines only');
    expect(confidence).toBe('high, raw only');
  });
});

describe('the rating of the secondary surfaces', () => {
  it('is medium, because the s1 and s6 snapshots are not identical', () => {
    const lines = (name) =>
      session(name).aria_snapshots.find((a) => a.name === 'ui-01-main-menu.yml').lines;
    expect(lines('s1-desktop')).not.toBe(lines('s6-desktop-fresh'));
    const text = doc('feature-inventory.md');
    expect(text).toContain('Rows without their own label are [O, medium]');
    expect(text).not.toMatch(/Rows without their own label are \[O, high\]/u);
    expect(doc('checkpoint.md')).not.toContain('The high rating of §2');
  });
});

describe('wording', () => {
  const emulating = () =>
    scenarios()
      .filter(({ steps }) => steps.some((step) => step.do === 'emulate'))
      .map(({ name }) => name.split('-')[0]);

  it('name every scenario that emulates', () => {
    expect(emulating()).toEqual(['00', '00c', '09', '11']);
    const texts = [doc('checkpoint.md'), flat(read('research/excalidraw/README.md'))];
    for (const text of texts) {
      expect(text).not.toMatch(
        /These are the only steps that emulate|Only 00 \(desktop\) and 09 \(mobile\) emulate/u,
      );
      expect(text).toMatch(/00c re-emulates after a driver restart, and 11 re-emulates/u);
    }
  });

  it('date the metric assertions from s6, because s1–s5 have none', () => {
    for (const name of [
      's1-desktop',
      's2-desktop-fresh',
      's3-mobile',
      's4-dpr-probe',
      's5-desktop-aborted',
    ]) {
      expect(session(name).steps.byKind.assertMetrics ?? 0, name).toBe(0);
    }
    expect(doc('checkpoint.md')).toMatch(/From s6 on, CSS viewport, DPR/u);
  });

  it('keep the remaining-copy wording, the regenerated summaries and the open items exact', () => {
    expect(doc('rea-findings.md')).not.toContain('so none remains');
    expect(doc('rea-findings.md')).toContain('no copy is known to remain');
    const methodology = doc('methodology.md');
    expect(methodology).not.toContain('The s1–s3 probe summaries regenerate');
    expect(methodology).toContain('All five probe summaries (s1, s2, s3, s6 and s7) regenerate');
    expect(doc('backlog.md')).not.toContain('so every criterion below is open');
  });
});

describe('the agent code map', () => {
  it('lists the research area with its test projects, lint globals and dependency', () => {
    const map = flat(read('AGENTS.md').split('## Code map')[1].split(/^## /mu)[0]);
    const pkg = JSON.parse(read('package.json'));
    expect(Object.keys(pkg.devDependencies)).toContain('playwright-core');
    for (const text of [
      'research/excalidraw',
      'research:unit',
      'research:integration',
      'playwright-core',
    ]) {
      expect(map).toContain(text);
    }
  });
});
