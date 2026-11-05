// Checks the record of the observation batch (s12-s14) against the committed s12-s14 evidence:
// the request start times, the REA window over mobile drawing, the verification page that
// stopped the desktop sessions and the mobile generation dialogs; and the criteria it changed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RE = 'docs/reverse-engineering';
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const flat = (text) => text.replaceAll('**', '').replaceAll('`', '').replace(/\s+/gu, ' ');
const evidence = (name) => JSON.parse(read(`${RE}/evidence/${name}`));
const checkpoint = () => read(`${RE}/checkpoint.md`);
const raw = (title) => checkpoint().split(`## ${title}\n`)[1].split(/^## /mu)[0];
const section = (title) => flat(raw(title));
const batch = () => section('Observation batch (s12–s14)');
const placement = (name) =>
  evidence('netlog-steps-s12-s14.json').sessions.find((s) => s.session === name);
const index = (name) => evidence('sessions-s12-s14.json').sessions.find((s) => s.session === name);
const row = (id) =>
  read(`${RE}/residual-matrix.md`)
    .split('\n')
    .find((line) => line.startsWith(`| ${id} |`))
    .split('|')
    .map((cell) => flat(cell).trim());
// The names of the rows of a checkpoint status table whose status is `status`, in table order.
const withStatus = (title, status) =>
  raw(title)
    .split('\n')
    .filter((line) => /^\| [^-]/u.test(line))
    .slice(1)
    .map((line) => line.split('|').map((cell) => flat(cell).trim()))
    .filter((cells) => cells[2] === status)
    .map((cells) => cells[1]);
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);

describe('the request start times and the REA window of s12', () => {
  it('state the start counts and the gap after drawing that the placement gives', () => {
    const { drawing } = placement('s12-mobile-draw-rea');
    expect(drawing.request_starts).toEqual({ known: 104, unknown: 0, during_drawing: 0 });
    expect(drawing.steps.touchDrag).toBe(3);
    expect(batch()).toContain(
      `records the start of all ${String(drawing.request_starts.known)} of its requests. None ` +
        `fell while one of scenario 10's ${String(drawing.steps.touchDrag)} touch drags`,
    );
    expect(batch()).toContain(`came ${seconds(drawing.next_entry_ms.min)} s or more after`);
  });

  it('state what the window retained and how early it armed', () => {
    const [win] = evidence('rea-windows-s12-s14.json').windows;
    const first = Date.parse(win.driver.first_step_at);
    const armed = seconds(first - Date.parse(win.window.start));
    const network = seconds(first - Date.parse(win.network_coverage_started_at));
    expect(win.allowed_origins).toHaveLength(7);
    expect(batch()).toContain(
      `armed ${armed} s before its first step, its network coverage ${network} s before`,
    );
    expect(batch()).toContain(
      `it retained ${String(win.network_requests)} requests, ` +
        `${String(win.websocket_connections)} WebSocket connections and ` +
        `${String(win.console_events)} console events`,
    );
  });
});

describe('the verification page and the mobile generation dialogs', () => {
  it.each(['s13-desktop-draw-rea', 's14-desktop-svg-only'])(
    'name the 403 load and the stopped assertions of %s',
    (name) => {
      const { network, steps } = index(name);
      expect(network.find((n) => n.type === 'document').status).toBe(403);
      expect(network.some((n) => n.path.startsWith('/.well-known/vercel/security/'))).toBe(true);
      expect(steps.failures).toEqual([
        expect.objectContaining({ step: 'assertMetrics', fatal: true }),
      ]);
    },
  );

  it('say that the stopped sessions sent no input and that nothing bypassed the page', () => {
    expect(batch()).toContain('answered the desktop load with HTTP 403');
    expect(batch()).toContain(
      'stopped 12, 23 and 17 at their first step, so no input reached the site',
    );
    expect(batch()).toContain('This research does not bypass such a page');
  });

  it('count the elements that the Mermaid insert added and the tool Wireframe to code set', () => {
    const probes = evidence('probes-s12-mobile-draw-rea.json');
    const before = probes.find((p) => p.label === 'm-dark-via-menu').elements.length;
    const after = probes.find((p) => p.label === '22-mermaid-inserted').elements;
    const added = after.slice(before);
    const count = (type) => added.filter((e) => e.type === type).length;
    expect(batch()).toContain(
      `Insert added ${String(added.length)} elements: ${String(count('rectangle'))} rectangles, ` +
        `${String(count('diamond'))} diamond, ${String(count('arrow'))} bound arrows and ` +
        `${String(added.filter((e) => e.container).length)} labels in containers`,
    );
    expect(probes.find((p) => p.label === '22-wireframe').tool).toBe('magicframe');
    expect(batch()).toContain('set the tool to magicframe');
  });
});

describe('the rows and criteria that the batch changed', () => {
  it('close R-72 and R-73, keep R-63 partial and Export to Link unobserved', () => {
    expect([row('R-72')[5], row('R-73')[5], row('R-63')[5], row('R-56')[5]]).toEqual([
      '✅',
      '✅',
      '🟡',
      '❌',
    ]);
    expect(row('R-56')[9]).toBe('1');
  });

  it('leave five acceptance criteria and two testing requirements partial', () => {
    expect(withStatus('Acceptance criteria', 'Partial')).toEqual([
      'feature-inventory.md covers all discovered features',
      'behavior-analysis.md',
      'limitations.md',
      'Desktop light/dark and mobile evidence sets',
      'Prioritised backlog with acceptance criteria',
    ]);
    expect(withStatus('Testing requirements', 'Partial')).toEqual([
      'Re-run each documented interaction from a fresh profile',
      'Separate Claude Code review session',
    ]);
    expect(flat(checkpoint())).toContain('Issue #1 stays open');
  });
});
