import { describe, expect, it } from 'vitest';

import { down, keyEvent, move, recogniserHarness, typesOf, up } from '../../support/inputs.ts';

// Two touch pointers, cancelling and focus loss
// (docs/architecture/engine/interaction.md#gesture-recogniser).

const touch = (id: number) => ({ id, pointer: 'touch' as const });

describe('a second touch pointer', () => {
  it('AC REQ-V07 cancels the tool gesture and starts a pinch from where both pointers are', () => {
    const { feed } = recogniserHarness();
    feed(down(100, 100, touch(1)), move(110, 100, touch(1)));
    expect(feed(down(200, 100, touch(2)))).toEqual([
      { type: 'cancel' },
      {
        type: 'pinch-start',
        from: [
          { x: 110, y: 100 },
          { x: 200, y: 100 },
        ],
      },
    ]);
    expect(feed(move(220, 100, touch(2)), move(100, 90, touch(1)))).toEqual([
      {
        type: 'pinch',
        from: [
          { x: 110, y: 100 },
          { x: 200, y: 100 },
        ],
        to: [
          { x: 110, y: 100 },
          { x: 220, y: 100 },
        ],
      },
      {
        type: 'pinch',
        from: [
          { x: 110, y: 100 },
          { x: 200, y: 100 },
        ],
        to: [
          { x: 100, y: 90 },
          { x: 220, y: 100 },
        ],
      },
    ]);
  });

  it('AC cancels a press that has not become a drag, and its long press', () => {
    const { feed, take, scheduler } = recogniserHarness();
    feed(down(0, 0, touch(1)));
    expect(typesOf(feed(down(50, 0, touch(2))))).toEqual(['cancel', 'pinch-start']);
    scheduler.advance(1_000);
    expect(take()).toEqual([]);
  });

  it('leaves the finger left behind doing nothing until it lifts, so no tool gesture follows', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, touch(1)), down(50, 0, touch(2)));
    expect(feed(up(50, 0, touch(2)), move(80, 30, touch(1)), up(80, 30, touch(1)))).toEqual([]);
    expect(typesOf(feed(down(0, 0, touch(3))))).toEqual(['press']);
  });

  it('pinches again when a new finger joins the one left behind', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, touch(1)), down(50, 0, touch(2)), up(50, 0, touch(2)));
    expect(feed(down(70, 0, touch(3)))).toEqual([
      {
        type: 'pinch-start',
        from: [
          { x: 0, y: 0 },
          { x: 70, y: 0 },
        ],
      },
    ]);
  });

  it('lets a third finger change nothing', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, touch(1)), down(50, 0, touch(2)));
    expect(feed(down(90, 0, touch(3)), move(95, 5, touch(3)), up(95, 5, touch(3)))).toEqual([]);
  });

  it('does not join a mouse or pen press, whose pointer is not a touch', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0));
    expect(
      feed(down(5, 5, { id: 2, pointer: 'pen' }), move(40, 5, { id: 2, pointer: 'pen' })),
    ).toEqual([]);
    expect(typesOf(feed(move(10, 0)))).toEqual(['drag-start']);
  });
});

describe('cancelling', () => {
  it('a cancelled pointer cancels its tool gesture, and ends a pinch', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0), move(10, 0));
    expect(feed({ ...up(10, 0), type: 'pointer-cancel' })).toEqual([{ type: 'cancel' }]);
    feed(down(0, 0, touch(4)), down(50, 0, touch(5)));
    expect(feed({ ...up(50, 0, touch(5)), type: 'pointer-cancel' }, move(9, 9, touch(5)))).toEqual(
      [],
    );
  });

  it('losing focus cancels the tool gesture and releases a held Space', () => {
    const { feed } = recogniserHarness();
    feed(keyEvent('key-down', ' ', 'Space'), keyEvent('key-up', 'a', 'KeyA'));
    feed({ type: 'focus-lost', time: 0 });
    feed(down(0, 0), move(20, 0));
    expect(feed({ type: 'focus-lost', time: 0 }, move(40, 0), up(40, 0))).toEqual([
      { type: 'cancel' },
    ]);
  });

  it('a camera drag ends silently when it is cancelled', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, { button: 'middle' }));
    expect(feed({ ...up(30, 0), type: 'pointer-cancel' }, move(60, 0))).toEqual([]);
  });

  it('a disposed recogniser drops its long press and ignores further input', () => {
    const { feed, take, scheduler, recogniser } = recogniserHarness();
    feed(down(0, 0, touch(1)));
    recogniser.dispose();
    expect(scheduler.pending()).toBe(0);
    expect(feed(move(50, 0, touch(1)), up(50, 0, touch(1)), down(0, 0))).toEqual([]);
    scheduler.advance(1_000);
    expect(take()).toEqual([]);
  });

  it('passes wheel events through untouched: they belong to the viewport', () => {
    const { feed } = recogniserHarness();
    const wheel = {
      type: 'wheel',
      at: { x: 0, y: 0 },
      delta: { x: 0, y: 10 },
      zoom: false,
    } as const;
    expect(
      feed({ ...wheel, modifiers: { shift: false, alt: false, mod: false }, time: 0 }),
    ).toEqual([]);
  });
});
