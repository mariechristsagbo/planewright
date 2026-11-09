import { describe, expect, it } from 'vitest';

import { worldBounds } from '../../src/geometry/world-bounds.ts';
import { decodeDocument } from '../../src/model/decode.ts';
import { encodeDocument } from '../../src/model/encode.ts';
import { isElementId } from '../../src/model/ids.ts';
import { compareCodeUnits } from '../../src/model/order-key.ts';
import { readStored } from '../../src/persistence/stored.ts';
import {
  PERF_KINDS,
  perfArea,
  perfDocument,
  perfElements,
  perfRecords,
} from '../support/perf-scenes.ts';

// The seeded scenes of the performance budgets (docs/architecture/engine/quality.md#performance-budgets):
// the same seed always gives the same scene, each scene mixes the P0 kinds inside its area, and
// every scene crosses the codec and the stored records as a saved drawing does.

const AREA = { x: -400, y: 100, width: 1600, height: 900 };

describe('perfElements', () => {
  it('gives the same scene for the same seed, and another for another seed', () => {
    const first = perfElements({ seed: 7, count: 300, area: AREA });
    expect(perfElements({ seed: 7, count: 300, area: AREA })).toEqual(first);
    expect(perfElements({ seed: 8, count: 300, area: AREA })).not.toEqual(first);
  });

  it.each([1, 10, 10_000])('makes exactly %i elements, each with its own identifier', (count) => {
    const elements = perfElements({ seed: 1, count, area: AREA });
    expect(elements).toHaveLength(count);
    expect(new Set(elements.map(({ id }) => id)).size).toBe(count);
    expect(elements.every(({ id }) => isElementId(id))).toBe(true);
  });

  it('lists the elements in drawing order, by strictly ascending order keys', () => {
    const keys = perfElements({ seed: 2, count: 2_000, area: AREA }).map(({ order }) => order);
    expect(keys.every((key, at) => at === 0 || compareCodeUnits(keys[at - 1] ?? '', key) < 0)).toBe(
      true,
    );
  });

  it('mixes every P0 kind, none of them in more than two fifths of the scene', () => {
    const elements = perfElements({ seed: 3, count: 5_000, area: AREA });
    const counts = PERF_KINDS.map((kind) => elements.filter((each) => each.kind === kind).length);
    expect(PERF_KINDS).toEqual(['rectangle', 'ellipse', 'diamond', 'line', 'freehand', 'text']);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(5_000);
    expect(Math.min(...counts)).toBeGreaterThan(250);
    expect(Math.max(...counts)).toBeLessThan(2_000);
    expect(elements.some(({ rotation }) => rotation !== 0)).toBe(true);
    expect(elements.some(({ style }) => style.fill !== null)).toBe(true);
  });

  it('keeps every element, turned or not, inside the area', { timeout: 30_000 }, () => {
    const outside = perfElements({ seed: 4, count: 3_000, area: AREA }).filter((element) => {
      const { x, y, width, height } = worldBounds(element);
      const inside =
        x >= AREA.x &&
        y >= AREA.y &&
        x + width <= AREA.x + AREA.width &&
        y + height <= AREA.y + AREA.height;
      return !inside;
    });
    expect(outside).toEqual([]);
  });

  it('makes the topmost elements long texts far from the area when asked', () => {
    const at = { x: -1_000_000, y: -1_000_000 };
    const longTexts = { count: 3, length: 100_000, at };
    const elements = perfElements({ seed: 5, count: 20, area: AREA, longTexts });
    const top = elements.slice(-3);
    expect(top.map(({ kind }) => kind)).toEqual(['text', 'text', 'text']);
    for (const text of top) {
      expect(text.kind === 'text' ? text.content.text.length : 0).toBe(100_000);
      expect(worldBounds(text).x + worldBounds(text).width).toBeLessThan(AREA.x);
    }
    for (const element of elements.slice(0, -3)) {
      expect(worldBounds(element).x).toBeGreaterThanOrEqual(AREA.x);
    }
  });
});

describe('perfDocument', () => {
  it('crosses the codec unchanged', { timeout: 30_000 }, () => {
    const document = perfDocument({ seed: 6, count: 1_000, area: AREA });
    const decoded = decodeDocument(encodeDocument(document));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect([...decoded.value.elements.values()]).toEqual([...document.elements.values()]);
  });

  it('crosses the codec with 100,000-character texts too', () => {
    const longTexts = { count: 2, length: 100_000, at: { x: -1e6, y: 0 } };
    const document = perfDocument({ seed: 6, count: 10, area: AREA, longTexts });
    expect(decodeDocument(encodeDocument(document)).ok).toBe(true);
  });
});

describe('perfRecords', () => {
  it(
    'stores the scene as a replacement would, and a load gives it back with its session',
    {
      timeout: 30_000,
    },
    () => {
      const spec = { seed: 9, count: 1_000, area: AREA };
      const session = { camera: { x: -400, y: 100, zoom: 0.5 }, selection: [] };
      const id = 'PerfDocument0000000000';
      const { record, elements } = perfRecords(spec, { id, session });
      expect(elements).toHaveLength(1_000);
      expect(record).toMatchObject({ id, rev: 1, session: { camera: session.camera } });
      const loaded = readStored({ record, elements });
      expect(loaded.type).toBe('loaded');
      if (loaded.type !== 'loaded') return;
      expect([...loaded.stored.document.elements.values()]).toEqual(perfElements(spec));
      expect(loaded.stored.session.camera).toEqual(session.camera);
    },
  );

  it('keeps a stored selection of existing elements', () => {
    const spec = { seed: 9, count: 100, area: AREA };
    const selection = perfElements(spec)
      .slice(0, 50)
      .map(({ id }) => id);
    const session = { camera: { x: 0, y: 0, zoom: 1 }, selection };
    const { record, elements } = perfRecords(spec, { id: 'PerfDocument0000000001', session });
    const loaded = readStored({ record, elements });
    expect(loaded.type === 'loaded' ? loaded.stored.session.selection : []).toEqual(selection);
  });
});

describe('perfArea', () => {
  const view = { width: 1000, height: 600 };
  const camera = { x: 200, y: -100, zoom: 0.5 };

  it('lies inside the view, a twentieth of it from each edge, for a whole scene in view', () => {
    expect(perfArea(view, camera, 1)).toEqual({ x: 300, y: -40, width: 1800, height: 1080 });
  });

  it('is ten times the view, about the same centre, for a tenth of the scene in view', () => {
    const area = perfArea(view, camera, 0.1);
    expect(area.width * area.height).toBeCloseTo(10 * 2000 * 1200, 3);
    expect(area.x + area.width / 2).toBeCloseTo(1200, 9);
    expect(area.y + area.height / 2).toBeCloseTo(500, 9);
    expect(area.width / area.height).toBeCloseTo(2000 / 1200, 9);
  });

  it('refuses a share of the scene in view outside (0, 1]', () => {
    expect(() => perfArea(view, camera, 0)).toThrow(RangeError);
    expect(() => perfArea(view, camera, 1.5)).toThrow(RangeError);
  });
});
