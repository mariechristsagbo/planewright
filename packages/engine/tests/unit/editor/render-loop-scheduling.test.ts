import { describe, expect, it } from 'vitest';

import { createRenderLoop } from '../../../src/editor/render-loop.ts';
import type { RenderFrame } from '../../../src/editor/render-frame.ts';
import { sceneOf, shapeElement } from '../../support/elements.ts';
import { createManualClock, createQueueScheduler } from '../../support/fakes.ts';
import { loopHarness } from '../../support/render-loops.ts';

// Frame scheduling (docs/architecture/engine/rendering-and-hit-testing.md#dirty-layers-and-scheduling):
// a dirty mark asks the scheduler for the next animation frame once, later marks are coalesced, and
// on that frame the loop builds one frame and hands it to its listeners.

const box = shapeElement('rectangle', 100, 50, { id: 1, x: 30, y: 40 });

describe('one render per animation frame', () => {
  it('AC several changes in one frame cause one render, with the latest state', () => {
    const { loop, scheduler, next, move } = loopHarness(box);
    expect(scheduler.pending()).toBe(0);
    move(box, 10);
    expect(scheduler.pending()).toBe(1);
    loop.update({ camera: { x: 5, y: 5, zoom: 2 } });
    loop.update({ selection: [box.id] });
    move(box, 10, 'remote');
    loop.update({ marquee: { x: 0, y: 0, width: 4, height: 4 }, theme: 'dark' });
    loop.invalidate();
    expect(scheduler.pending()).toBe(1);
    const frames = next();
    expect(frames).toHaveLength(1);
    expect(frames[0]?.camera).toEqual({ x: 5, y: 5, zoom: 2 });
    expect(frames[0]?.theme).toBe('dark');
    expect(frames[0]?.scene?.elements[0]?.x).toBe(50);
    expect(frames[0]?.overlay?.primitives.at(-1)?.type).toBe('marquee');
  });

  it('REQ-F02 draws a change in the very next animation frame, then asks for no more', () => {
    const { loop, scheduler, next } = loopHarness(box);
    loop.update({ selection: [box.id] });
    expect(next()).toHaveLength(1);
    expect(scheduler.pending()).toBe(0);
    expect(next()).toEqual([]);
  });

  it('keeps a change made while a frame is handed over for the following frame', () => {
    const { loop, next } = loopHarness(box);
    let zoomed = false;
    loop.onFrame(() => {
      if (zoomed) return;
      zoomed = true;
      loop.update({ camera: { x: 0, y: 0, zoom: 2 } });
    });
    const first = next();
    expect(first.map(({ camera }) => camera.zoom)).toEqual([1]);
    expect(next().map(({ camera }) => camera.zoom)).toEqual([2]);
  });
});

describe('pulling a frame', () => {
  it('builds the frame of the dirty layers and clears them, so the animation frame has none', () => {
    const { loop, next } = loopHarness(box);
    loop.update({ selection: [box.id] });
    const frame = loop.frame();
    expect(frame?.overlay?.primitives).toHaveLength(10);
    expect(frame?.scene).toBeUndefined();
    expect(loop.frame()).toBeNull();
    expect(next()).toEqual([]);
  });
});

describe('frame listeners', () => {
  it('ask for no frame before one listens, then get a full frame', () => {
    const scheduler = createQueueScheduler(createManualClock());
    const loop = createRenderLoop(sceneOf(box), scheduler);
    loop.update({ viewport: { width: 400, height: 300, pixelRatio: 2 } });
    expect(scheduler.pending()).toBe(0);
    const frames: RenderFrame[] = [];
    loop.onFrame((frame) => frames.push(frame));
    expect(scheduler.pending()).toBe(1);
    scheduler.frame();
    expect(frames).toHaveLength(1);
    expect(frames[0]?.scene?.elements).toEqual([box]);
    expect(frames[0]?.overlay).toEqual({ primitives: [] });
  });

  it('each get the same frame, and a cancelled one gets no more', () => {
    const { loop, next } = loopHarness(box);
    const seen: RenderFrame[] = [];
    const cancel = loop.onFrame((frame) => seen.push(frame));
    const [frame] = next();
    expect(seen).toEqual([frame]);
    expect(seen[0]).toBe(frame);
    cancel();
    loop.invalidate();
    expect(next()).toHaveLength(1);
    expect(seen).toHaveLength(1);
  });

  it('are all told even when one throws, whose error then reaches the scheduler', () => {
    const { loop, scheduler } = loopHarness(box);
    const failure = new Error('cannot draw');
    loop.onFrame(() => {
      throw failure;
    });
    const seen: RenderFrame[] = [];
    loop.onFrame((frame) => seen.push(frame));
    expect(() => {
      scheduler.frame();
    }).toThrow(failure);
    expect(seen).toHaveLength(1);
    loop.invalidate();
    expect(scheduler.pending()).toBe(1);
  });

  it('once all have gone, ask for no frame until one listens again', () => {
    const scheduler = createQueueScheduler(createManualClock());
    const loop = createRenderLoop(sceneOf(box), scheduler);
    const cancel = loop.onFrame(() => undefined);
    scheduler.frame();
    cancel();
    loop.invalidate();
    expect(scheduler.pending()).toBe(0);
  });
});

describe('a disposed render loop', () => {
  it('cancels the frame it asked for and stops following the scene', () => {
    const { loop, scheduler, move } = loopHarness(box);
    loop.update({ selection: [box.id] });
    expect(scheduler.pending()).toBe(1);
    loop.dispose();
    expect(scheduler.pending()).toBe(0);
    move(box, 10);
    expect(scheduler.pending()).toBe(0);
    loop.dispose();
  });

  it('refuses to be changed, pulled or listened to', () => {
    const { loop } = loopHarness(box);
    loop.dispose();
    const disposed = /disposed/;
    expect(() => {
      loop.update({ selection: [] });
    }).toThrow(disposed);
    expect(() => {
      loop.invalidate();
    }).toThrow(disposed);
    expect(() => loop.frame()).toThrow(disposed);
    expect(() => loop.onFrame(() => undefined)).toThrow(disposed);
  });
});
