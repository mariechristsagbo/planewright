// Checks the record of the mobile radio and edit batch (s51–s57) against its committed evidence:
// the load check and the gates, the one Export to Link upload (R-56) and that no record keeps its
// link, the REA windows, the replays, the text and freehand radios and Autoshape (R-10, R-43),
// Delete, the points and the group alignment (R-11, R-30, R-51), Add link, and the rows that cite
// them.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ROOT,
  RE,
  cells,
  differing,
  entry,
  evidence,
  field,
  flat,
  probe,
  read,
} from './r76-evidence.mjs';

const section = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Mobile radio and edit batch (s51–s57)\n')[1]
      .split(/^## /mu)[0],
  );
const SESSIONS = [
  's51-mobile-load-gate',
  's52-mobile-export-link',
  's53-mobile-radios-autoshape',
  's54-mobile-edits-link',
  's55-mobile-radios-points',
  's56-mobile-edits-link-2',
  's57-mobile-radios-points-2',
];
const [, LINK, RADIOS, EDITS, POINTS, EDITS2, POINTS2] = SESSIONS;
const index = () => evidence('sessions-s51-s57.json').sessions;
const seconds = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
const elements = (name, label) => probe(name, label).elements;
const last = (name, label) => elements(name, label).at(-1);
const arrow = (name, label) => elements(name, label).find((e) => e.type === 'arrow');

describe('the loads, the gates and the windows of the batch', () => {
  it('state that every load passed the gate, with the step and assertion counts', () => {
    expect(index().map((s) => s.session)).toEqual(SESSIONS);
    for (const { network, steps } of index()) {
      const documents = network.filter((n) => n.type === 'document').map((n) => n.status);
      expect(documents).toEqual([200]);
      expect(network.some((n) => n.path.startsWith('/.well-known/vercel/'))).toBe(false);
      expect(network.some((n) => n.path.endsWith('.map'))).toBe(false);
      const loaded = steps.metrics.filter((m) => m.canvases.length > 0);
      for (const c of loaded[0].canvases) expect([c.width, c.height]).toEqual([1170, 2532]);
    }
    expect(index().map((s) => s.steps.byKind.assertMetrics)).toEqual([1, 3, 3, 5, 5, 5, 5]);
    expect(index().map((s) => s.steps.failed)).toEqual([0, 1, 0, 0, 0, 0, 0]);
    expect(section()).toContain('(1 in s51, 3 in s52 and s53, 5 in each of s54–s57)');
    expect(section()).toContain('The only failed step was the second Close of 44 in s52');
  });

  it('state how early the windows armed and that they kept no traffic', () => {
    const wins = evidence('rea-windows-s51-s57.json').windows;
    expect(wins).toHaveLength(10);
    const over = wins.filter((w) => w.driver.first_step_at !== null);
    const leads = over.map((w) => Date.parse(w.driver.first_step_at) - Date.parse(w.window.start));
    for (const w of wins) {
      expect(w.allowed_origins).toHaveLength(7);
      expect([w.network_requests, w.websocket_connections, w.console_events]).toEqual([0, 0, 0]);
    }
    for (const w of over)
      expect(Date.parse(w.window.end)).toBeGreaterThan(Date.parse(w.driver.last_step_at));
    expect(section()).toContain(
      `armed ${seconds(Math.min(...leads))}–${seconds(Math.max(...leads))} s before its first step`,
    );
    expect(section()).toContain('All 10 inspections returned Evidence and kept 0 requests');
    expect(wins.some((w) => w.session === LINK)).toBe(false);
  });

  it('state the replays and that only the export requests followed the loads', () => {
    const pairs = [
      [POINTS, RADIOS],
      [POINTS2, RADIOS],
      [POINTS2, POINTS],
      [EDITS2, EDITS],
    ];
    const shared = pairs.map(([later, earlier]) => {
      const { shared: count, labels } = differing(later, earlier);
      expect(labels, later).toEqual([]);
      return count;
    });
    expect(shared).toEqual([20, 20, 32, 30]);
    expect(section()).toContain("(20 labels each); 48's 12 labels are identical in s55 and s57");
    const placed = evidence('netlog-steps-s51-s57.json').sessions;
    expect(placed.map((s) => s.netlog_entries)).toEqual([20, 23, 20, 20, 20, 20, 20]);
    for (const s of placed) expect(s.drawing.request_starts.during_drawing).toBe(0);
  });
});

describe('the Export to Link record (R-56)', () => {
  const session = () => index().find((s) => s.session === LINK);

  it('states the one upload request and the unchanged scene', () => {
    const posts = session().network.filter((n) => n.method === 'POST');
    expect(posts.map((n) => [n.origin, n.path, n.status])).toEqual([
      ['https://json.excalidraw.com', '/api/v2/post/', 200],
      ['https://sentry.io', '/api/5179260/envelope/', 200],
    ]);
    expect(section()).toContain('one POST to https://json.excalidraw.com/api/v2/post/ (HTTP 200)');
    const scene = (label) => JSON.stringify(elements(LINK, label));
    expect(scene('44-after-close')).toBe(scene('44-drawn'));
    expect(field(entry('B-41'), 'Undo/redo')).toMatch(/^not applicable \(/u);
    expect(cells('R-56').slice(4, 6)).toEqual(['❌/❌/✅', '🟡']);
  });

  it('keeps no link value in any committed evidence file or research document', () => {
    const dir = join(ROOT, RE, 'evidence');
    const texts = readdirSync(dir).map((name) => readFileSync(join(dir, name), 'utf8'));
    texts.push(
      ...readdirSync(join(ROOT, RE))
        .filter((n) => n.endsWith('.md'))
        .map((n) => read(`${RE}/${n}`)),
    );
    for (const text of texts) expect(/json=(?!<redacted>)[A-Za-z0-9_-]{6}/u.test(text)).toBe(false);
  });
});

describe('the radio and Autoshape records (R-10, R-43)', () => {
  it('states the font sizes, the alignments and the text boxes', () => {
    const text = (label) => last(RADIOS, label);
    expect(['45-text', '45-size-l', '45-size-xl', '45-size-s'].map((l) => text(l).font[0])).toEqual(
      [20, 28, 36, 16],
    );
    expect(
      ['45-align-centre', '45-align-centre-undo', '45-align-right'].map((l) => text(l).font[2]),
    ).toEqual(['center', 'left', 'right']);
    expect(text('45-size-xl').box).toEqual([60, 277.5, 72.9, 45]);
    expect(field(entry('B-06'), 'Desktop/mobile')).toContain(
      '[60,290,32.4,20], [60,282.5,56.7,35] and [60,277.5,72.9,45]',
    );
    expect(cells('R-10')[4]).toBe('🟡/✅/✅');
  });

  it('states the stroke widths, the pressure style and the Autoshape rectangle', () => {
    const stroke = (label) => elements(RADIOS, label).find((e) => e.type === 'freedraw');
    expect(
      ['45-freedraw', '45-width-bold', '45-width-thin'].map((l) => stroke(l).style[3]),
    ).toEqual([1, 2, 0.5]);
    expect(
      ['45-freedraw', '45-pressure-2', '45-pressure-2-undo'].map(
        (l) => stroke(l).strokeOptions.variability,
      ),
    ).toEqual(['constant', 'variable', 'constant']);
    expect(probe(RADIOS, '45-autoshape').tool).toBe('autoshape');
    expect([last(RADIOS, '45-autoshape').type, last(RADIOS, '45-autoshape').box]).toEqual([
      'rectangle',
      [58, 527, 244, 106],
    ]);
    expect(elements(RADIOS, '45-autoshape-undo')).toHaveLength(2);
    expect(field(entry('B-05'), 'Desktop/mobile')).toContain(
      'variability from constant to variable',
    );
    expect(cells('R-43')[4]).toBe('✅/❌/✅');
  });
});

describe('the Delete, point, alignment and link records (R-11, R-30, R-51)', () => {
  it('states the moved arrow, the fourth point and the deleted point', () => {
    expect(
      ['46-point-3', '46-point-4', '46-point-4-undo'].map((l) => arrow(EDITS, l).box[1]),
    ).toEqual([250, 310, 250]);
    expect(arrow(EDITS, '46-point-4').points).toBe(3);
    const points = [
      '48-point-3',
      '48-point-4',
      '48-point-4-undo',
      '48-point-delete',
      '48-point-delete-undo',
    ];
    expect(points.map((l) => arrow(POINTS, l).points)).toEqual([3, 4, 3, 3, 4]);
    expect(field(entry('B-40'), 'Edge cases')).toContain('moved the whole arrow by 60 down');
    expect(cells('R-30')[4]).toBe('❌/❌/✅');
  });

  it('states Delete, the group alignment and the link with its undo', () => {
    expect(
      ['46-delete', '46-delete-undo', '46-delete-redo'].map((l) => elements(EDITS, l).length),
    ).toEqual([0, 1, 0]);
    const members = (label) =>
      elements(EDITS, label)
        .filter((e) => e.groups === 1)
        .map((e) => e.box.slice(0, 2));
    expect(members('46-align-left')).toEqual([
      [20, 330],
      [180, 400],
    ]);
    expect(members('46-align-bottom')).toEqual([
      [40, 440],
      [200, 510],
    ]);
    expect(last(EDITS, '47-link').link).toEqual({
      origin: 'https://example.com',
      path: '/planewright-r11',
    });
    expect(elements(EDITS, '47-link-undo')).toHaveLength(elements(EDITS, '47-link').length - 1);
    expect('link' in last(EDITS, '47-link-redo')).toBe(false);
    expect(field(entry('B-42'), 'Undo/redo')).toContain(
      'Redo restored the rectangle without its link',
    );
    expect(field(entry('B-23'), 'Edge cases')).toContain('the members at x 20 and 180');
    expect(cells('R-11').slice(4, 6)).toEqual(['—/—/✅', '✅']);
  });
});
