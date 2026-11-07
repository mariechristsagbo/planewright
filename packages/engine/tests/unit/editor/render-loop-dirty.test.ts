import { describe, expect, it } from 'vitest';

import type { RenderState } from '../../../src/editor/frame.ts';
import { openTransaction } from '../../../src/scene/transaction.ts';
import { shapeElement } from '../../support/elements.ts';
import { loopHarness } from '../../support/render-loops.ts';
import { changeSet } from '../../support/scene-state.ts';

// Dirty tracking (docs/architecture/engine/rendering-and-hit-testing.md#dirty-layers-and-scheduling):
// which layers each change marks dirty, and so which parts the next frame carries.

const box = shapeElement('rectangle', 100, 50, { id: 1, x: 30, y: 40 });
const other = shapeElement('ellipse', 20, 20, { id: 2, x: 200, y: 40 });

/** Which layers a frame redraws. */
const layersOf = (frame: object) => ({ scene: 'scene' in frame, overlay: 'overlay' in frame });
const BOTH = { scene: true, overlay: true };

describe('what a scene update redraws', () => {
  it.each(['local', 'history', 'load', 'remote'] as const)(
    'a %s change set marks both layers dirty',
    (origin) => {
      const { next, move } = loopHarness(box);
      move(box, 10, origin);
      expect(next().map(layersOf)).toEqual([BOTH]);
    },
  );

  it('a transient preview marks both layers dirty, and so does its revert', () => {
    const { store, next } = loopHarness(box);
    const transaction = openTransaction(store);
    const update = { type: 'update', id: box.id, before: { x: 30 }, after: { x: 50 } } as const;
    transaction.preview(changeSet([update]));
    expect(next().map(layersOf)).toEqual([BOTH]);
    transaction.cancel();
    expect(next().map(layersOf)).toEqual([BOTH]);
  });
});

describe('what a change of the render state redraws', () => {
  const both: readonly (readonly [string, Partial<RenderState>])[] = [
    ['a camera change', { camera: { x: 5, y: 0, zoom: 1 } }],
    ['a resize', { viewport: { width: 800, height: 600, pixelRatio: 1 } }],
    ['a pixel-ratio change', { viewport: { width: 0, height: 0, pixelRatio: 2 } }],
    ['a theme change', { theme: 'dark' }],
  ];

  it.each(both)('%s marks both layers dirty', (_, change) => {
    const { loop, next } = loopHarness(box);
    loop.update(change);
    expect(next().map(layersOf)).toEqual([BOTH]);
  });

  it('a font that finished loading marks both layers dirty through invalidate', () => {
    const { loop, next } = loopHarness(box);
    loop.invalidate();
    expect(next().map(layersOf)).toEqual([BOTH]);
  });

  const overlayOnly: readonly (readonly [string, Partial<RenderState>])[] = [
    ['a selection change', { selection: [box.id] }],
    ['a change of the pointer that sizes the handles', { pointer: 'touch' }],
    ['a marquee', { marquee: { x: 0, y: 0, width: 10, height: 10 } }],
    ['the end of a marquee', { marquee: null }],
  ];

  it.each(overlayOnly)('%s redraws the overlay layer and not the scene layer', (_, change) => {
    const { loop, next } = loopHarness(box);
    loop.update(change);
    const frames = next();
    expect(frames.map(layersOf)).toEqual([{ scene: false, overlay: true }]);
    expect(frames[0]?.scene).toBeUndefined();
  });

  it('hiding an element redraws only the scene layer, which skips it', () => {
    const { loop, next } = loopHarness(box);
    loop.update({ hidden: [box.id] });
    const frames = next();
    expect(frames.map(layersOf)).toEqual([{ scene: true, overlay: false }]);
    expect(frames[0]?.scene?.hidden).toEqual([box.id]);
  });

  it('an empty change marks nothing and asks for no frame', () => {
    const { loop, scheduler, next } = loopHarness(box);
    loop.update({});
    expect(scheduler.pending()).toBe(0);
    expect(next()).toEqual([]);
  });

  it('keeps the latest value of every field, which the next frame shows', () => {
    const { loop, next } = loopHarness(box);
    loop.update({ selection: [box.id], theme: 'dark' });
    loop.update({ camera: { x: 1, y: 2, zoom: 3 }, selection: [] });
    expect(loop.state()).toMatchObject({ camera: { x: 1, y: 2, zoom: 3 }, theme: 'dark' });
    const [frame] = next();
    expect(frame?.camera).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(frame?.theme).toBe('dark');
    expect(frame?.overlay?.primitives).toEqual([]);
  });
});

describe('removed elements', () => {
  it('reach the next scene frame once, so that a renderer drops what it cached for them', () => {
    const { store, loop, next } = loopHarness(box, other);
    store.apply(changeSet([{ type: 'remove', element: box }]), 'local');
    expect(next()[0]?.scene).toMatchObject({ elements: [other], removed: [box.id] });
    loop.invalidate();
    expect(next()[0]?.scene?.removed).toEqual([]);
  });

  it('are still reported when they come back before the frame, so the cache cannot keep them', () => {
    const { store, next } = loopHarness(box);
    store.apply(changeSet([{ type: 'remove', element: box }]), 'local');
    store.apply(changeSet([{ type: 'add', element: box }]), 'history');
    expect(next()[0]?.scene).toMatchObject({ elements: [box], removed: [box.id] });
  });
});

describe('the viewport that the canvas host reports', () => {
  const refused: readonly (readonly [string, RenderState['viewport']])[] = [
    ['a negative width', { width: -1, height: 10, pixelRatio: 1 }],
    ['an infinite height', { width: 10, height: Infinity, pixelRatio: 1 }],
    ['a width that is not a number', { width: NaN, height: 10, pixelRatio: 1 }],
    ['a pixel ratio of 0', { width: 10, height: 10, pixelRatio: 0 }],
    ['an infinite pixel ratio', { width: 10, height: 10, pixelRatio: Infinity }],
    ['a pixel ratio that is not a number', { width: 10, height: 10, pixelRatio: NaN }],
  ];

  it.each(refused)(
    'is refused with %s, and the state and the layers stay as they were',
    (_, viewport) => {
      const { loop, scheduler } = loopHarness(box);
      const before = loop.state();
      expect(() => {
        loop.update({ viewport, selection: [box.id] });
      }).toThrow(RangeError);
      expect(loop.state()).toBe(before);
      expect(scheduler.pending()).toBe(0);
    },
  );

  it('may be empty, as it is before the canvas host is laid out', () => {
    const { loop } = loopHarness(box);
    loop.update({ viewport: { width: 0, height: 0, pixelRatio: 0.5 } });
    expect(loop.state().viewport).toEqual({ width: 0, height: 0, pixelRatio: 0.5 });
  });
});
