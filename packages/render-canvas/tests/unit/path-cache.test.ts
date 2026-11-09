import { describe, expect, it, vi } from 'vitest';

import { createPathCache, PATH_CACHE_LIMIT } from '../../src/path-cache.ts';
import { arrow, color, freehand, id, line, shape, text } from '../support/elements.ts';
import { fixedAdvanceMeasurer, pathFactory } from '../support/recording.ts';

// The path cache (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer):
// one path per element, keyed by identifier and revision, dropped when the element is removed or
// when the cache passes 20,000 entries, least recently used first.

const SQUARE = { width: 10, height: 10 };

function cacheOf(limit?: number) {
  const paths = pathFactory();
  const measurer = fixedAdvanceMeasurer();
  return { paths, measurer, cache: createPathCache(paths.createPath, measurer, limit) };
}

describe('the path cache', () => {
  it('holds at most 20,000 paths by default', () => {
    expect(PATH_CACHE_LIMIT).toBe(20_000);
  });

  it('AC rebuilds a path only when its element’s revision changes', () => {
    const { paths, cache } = cacheOf();
    const first = shape('rectangle', SQUARE, { rev: 3 });
    const drawing = cache.drawingOf(first);
    expect(cache.drawingOf(first)).toBe(drawing);
    // The same revision as a new object, even one that differs, keeps the cached path.
    expect(cache.drawingOf({ ...first, x: 99 })?.path).toBe(drawing?.path);
    expect(paths.made).toHaveLength(1);
    const next = { ...first, width: 20, rev: 4 };
    expect(cache.drawingOf(next)?.path).not.toBe(drawing?.path);
    expect(paths.made).toHaveLength(2);
    expect(cache.drawingOf(next)?.element).toBe(next);
    expect(paths.made).toHaveLength(2);
  });

  it("traces each kind's outline from the engine's geometry in its local frame", () => {
    const { paths, cache } = cacheOf();
    cache.drawingOf(shape('rectangle', { width: 100, height: 50 }, { x: 30, y: 40 }));
    cache.drawingOf(
      line(
        [
          { x: 0, y: 0 },
          { x: 50, y: 25 },
        ],
        { id: 2 },
      ),
    );
    cache.drawingOf(shape('ellipse', { width: 40, height: 20 }, { id: 3 }));
    expect(paths.made[0]?.commands).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 100, 0],
      ['lineTo', 100, 50],
      ['lineTo', 0, 50],
      ['closePath'],
    ]);
    expect(paths.made[1]?.commands).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 50, 25],
    ]);
    const ellipse = paths.made[2]?.commands ?? [];
    expect(ellipse.map(([name]) => name)).toEqual([
      'moveTo',
      'bezierCurveTo',
      'bezierCurveTo',
      'bezierCurveTo',
      'bezierCurveTo',
      'closePath',
    ]);
  });

  it('makes a one-point freehand stroke a disc as wide as its stroke, filled rather than stroked', () => {
    const { paths, cache } = cacheOf();
    const stroke6 = { color: color('#000000'), width: 6, dash: 'solid' } as const;
    const dot = freehand([{ x: 0, y: 0 }], { style: { stroke: stroke6 } });
    expect(cache.drawingOf(dot)).toMatchObject({ dot: true, closed: false });
    expect(paths.made[0]?.commands).toEqual([['arc', 0, 0, 3, 0, 2 * Math.PI]]);
    const stroke = freehand(
      [
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ],
      { id: 2 },
    );
    expect(cache.drawingOf(stroke)).toMatchObject({ dot: false, closed: false });
  });

  it('keeps the box each element turns about, closedness, and nothing to draw for later kinds', () => {
    const { paths, cache } = cacheOf();
    const points = [
      { x: 0, y: 5 },
      { x: 30, y: 0 },
    ];
    expect(cache.drawingOf(line(points))).toMatchObject({ width: 30, height: 5, closed: false });
    expect(cache.drawingOf(shape('diamond', SQUARE, { id: 2 }))).toMatchObject({
      width: 10,
      height: 10,
      closed: true,
    });
    expect(cache.drawingOf(arrow({ id: 3 }))).toBeUndefined();
    expect(cache.peek(id(3))).toBeUndefined();
    expect(paths.made).toHaveLength(2);
  });

  it('lays a text out once per revision, beside its box path', () => {
    const { measurer, cache } = cacheOf();
    const note = text({ text: 'one\ntwo' }, { rev: 1 });
    const drawing = cache.drawingOf(note);
    expect(drawing?.layout).toEqual({
      lines: [
        { text: 'one', width: 30 },
        { text: 'two', width: 30 },
      ],
      lineHeight: 25,
      width: 30,
      height: 50,
    });
    cache.drawingOf({ ...note });
    expect(measurer.measured).toEqual(['one', 'two']);
    cache.drawingOf({ ...note, rev: 2 });
    expect(measurer.measured).toEqual(['one', 'two', 'one', 'two']);
    expect(cache.drawingOf(shape('rectangle', SQUARE, { id: 2 }))?.layout).toBeNull();
  });

  it('drops the paths of removed elements, so that a returning element is traced again', () => {
    const { paths, cache } = cacheOf();
    const square = shape('rectangle', SQUARE);
    cache.drawingOf(square);
    expect(cache.peek(square.id)?.element).toBe(square);
    cache.drop([square.id, id(9)]);
    expect(cache.peek(square.id)).toBeUndefined();
    expect(cache.size).toBe(0);
    cache.drawingOf(square);
    expect(paths.made).toHaveLength(2);
  });

  it('drops the least recently used path once it holds more than its limit', () => {
    const { cache } = cacheOf(3);
    const squares = [1, 2, 3, 4].map((index) => shape('rectangle', SQUARE, { id: index }));
    const [a, b, c, d] = squares;
    if (!a || !b || !c || !d) throw new Error('four squares');
    cache.drawingOf(a);
    cache.drawingOf(b);
    cache.drawingOf(c);
    cache.drawingOf(a);
    cache.drawingOf(d);
    expect(cache.size).toBe(3);
    expect([a, b, c, d].map((square) => cache.peek(square.id) !== undefined)).toEqual([
      true,
      false,
      true,
      true,
    ]);
  });

  it('REQ-F01 finds a held drawing below its limit without walking the cache', () => {
    // Walking a map from its start steps over every slot that a deleted entry left, so a walk on
    // each lookup made a frame of 5,000 elements quadratic (ENG-15's B1 measurement).
    const { cache } = cacheOf();
    const squares = Array.from({ length: 50 }, (_, index) =>
      shape('rectangle', SQUARE, { id: index + 1 }),
    );
    for (const square of squares) cache.drawingOf(square);
    const walk = vi.spyOn(Map.prototype, Symbol.iterator);
    try {
      for (const square of squares) cache.drawingOf(square);
      expect(walk).not.toHaveBeenCalled();
    } finally {
      walk.mockRestore();
    }
    expect(cache.size).toBe(50);
  });

  it('REQ-F01 keeps its use order without taking a held drawing out of its map and back in', () => {
    // Deleting and setting an entry again on each lookup cost a tenth of B1's scene render in a
    // profile of 5,000 elements (issue #34).
    const { cache } = cacheOf();
    const squares = Array.from({ length: 50 }, (_, index) =>
      shape('rectangle', SQUARE, { id: index + 1 }),
    );
    for (const square of squares) cache.drawingOf(square);
    const removed = vi.spyOn(Map.prototype, 'delete');
    const added = vi.spyOn(Map.prototype, 'set');
    try {
      for (const square of squares) cache.drawingOf(square);
      expect(removed).not.toHaveBeenCalled();
      expect(added).not.toHaveBeenCalled();
    } finally {
      removed.mockRestore();
      added.mockRestore();
    }
  });

  it('drops the least recently used first, whatever was used, changed or dropped since', () => {
    const { cache } = cacheOf(3);
    const squares = [1, 2, 3, 4, 5].map((index) => shape('rectangle', SQUARE, { id: index }));
    const [a, b, c, d, e] = squares;
    if (!a || !b || !c || !d || !e) throw new Error('five squares');
    const held = () => squares.map((square) => cache.peek(square.id) !== undefined);
    cache.drawingOf(a);
    cache.drawingOf(b);
    cache.drawingOf(c);
    // A new revision is used last; a dropped element is gone at once.
    cache.drawingOf({ ...a, rev: 2 });
    cache.drop([c.id]);
    cache.drawingOf(d);
    cache.drawingOf(b);
    // In use order a, d, b: a fourth element drops a.
    cache.drawingOf(e);
    expect(held()).toEqual([false, true, false, true, true]);
    expect(cache.size).toBe(3);
    cache.drawingOf(c);
    expect(held()).toEqual([false, true, true, false, true]);
    cache.drop([b.id, e.id, c.id]);
    expect(cache.size).toBe(0);
    cache.drawingOf(a);
    expect(held()).toEqual([true, false, false, false, false]);
  });

  it('empties when cleared', () => {
    const { cache } = cacheOf();
    cache.drawingOf(shape('rectangle', SQUARE));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
