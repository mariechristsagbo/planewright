import { describe, expect, it } from 'vitest';

import { down, keyEvent, move, recogniserHarness, typesOf, up } from '../../support/inputs.ts';

// The gesture recogniser (docs/architecture/engine/interaction.md#gesture-recogniser): thresholds
// in screen pixels by pointer kind, taps, double taps, long presses, camera drags and the second
// touch pointer that cancels a tool gesture.

const NONE = { shift: false, alt: false, mod: false };

describe('drag thresholds', () => {
  it('AC a mouse press becomes a drag only once it has moved more than 3 px', () => {
    const { feed } = recogniserHarness();
    expect(feed(down(10, 10))).toEqual([
      { type: 'press', at: { x: 10, y: 10 }, pointer: 'mouse', modifiers: NONE },
    ]);
    expect(feed(move(13, 10))).toEqual([]);
    expect(feed(move(13.5, 10))).toEqual([
      { type: 'drag-start', at: { x: 13.5, y: 10 }, pointer: 'mouse', modifiers: NONE },
    ]);
    expect(typesOf(feed(move(20, 10), move(30, 12)))).toEqual(['drag', 'drag']);
    expect(feed(up(30, 12))).toEqual([
      { type: 'release', at: { x: 30, y: 12 }, pointer: 'mouse', modifiers: NONE },
    ]);
  });

  it.each([
    ['pen', 3],
    ['touch', 6],
  ] as const)('AC a %s press becomes a drag past %d px', (pointer, threshold) => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, { pointer }));
    expect(feed(move(0, threshold, { pointer }))).toEqual([]);
    expect(typesOf(feed(move(0, threshold + 0.01, { pointer })))).toEqual(['drag-start']);
  });

  it('measures the distance from the press, not each axis on its own', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0));
    expect(typesOf(feed(move(2.5, 2.5)))).toEqual(['drag-start']);
  });

  it('carries the pressure and the modifiers of each event', () => {
    const { feed } = recogniserHarness();
    expect(feed(down(0, 0, { pointer: 'pen', pressure: 0.4 }))[0]).toMatchObject({
      pressure: 0.4,
    });
    expect(feed(move(9, 0, { pointer: 'pen', pressure: 0.7, modifiers: { shift: true } }))).toEqual(
      [
        {
          type: 'drag-start',
          at: { x: 9, y: 0 },
          pointer: 'pen',
          modifiers: { ...NONE, shift: true },
          pressure: 0.7,
        },
      ],
    );
  });
});

describe('taps', () => {
  it('AC a mouse release before a drag is a tap at the press point, however long it took', () => {
    const { feed } = recogniserHarness();
    feed(down(10, 10), move(12, 11));
    expect(feed(up(12, 11, { time: 5_000 }))).toEqual([
      { type: 'tap', at: { x: 10, y: 10 }, pointer: 'mouse', modifiers: NONE },
    ]);
  });

  it.each(['touch', 'pen'] as const)('AC a %s tap must be shorter than 500 ms', (pointer) => {
    const { feed } = recogniserHarness();
    feed(down(0, 0, { pointer, time: 1_000 }));
    expect(typesOf(feed(up(0, 0, { pointer, time: 1_499 })))).toEqual(['tap']);
    feed(down(50, 0, { pointer, time: 2_000 }));
    expect(typesOf(feed(up(50, 0, { pointer, time: 2_500 })))).toEqual(['release']);
  });

  it('ignores secondary-button presses, which the context menu will use', () => {
    const { feed } = recogniserHarness();
    expect(feed(down(0, 0, { button: 'secondary' }), move(40, 0), up(40, 0))).toEqual([]);
  });
});

describe('double taps', () => {
  const tapAt = (x: number, time: number) => [down(x, 0, { time }), up(x, 0, { time })];
  /** What each press ended as. */
  const endings = (gestures: Parameters<typeof typesOf>[0]) =>
    typesOf(gestures).filter((type) => type !== 'press');

  it('AC two taps within 400 ms and 8 px make a double tap', () => {
    const { feed } = recogniserHarness();
    expect(endings(feed(...tapAt(0, 1_000), ...tapAt(8, 1_400)))).toEqual(['tap', 'double-tap']);
  });

  it('AC a second tap later than 400 ms or farther than 8 px is a tap again', () => {
    const late = recogniserHarness();
    expect(endings(late.feed(...tapAt(0, 1_000), ...tapAt(0, 1_401)))).toEqual(['tap', 'tap']);
    const far = recogniserHarness();
    expect(endings(far.feed(...tapAt(0, 1_000), ...tapAt(8.01, 1_100)))).toEqual(['tap', 'tap']);
  });

  it('starts again after a double tap, so a third tap is a tap', () => {
    const { feed } = recogniserHarness();
    const taps = feed(...tapAt(0, 0), ...tapAt(0, 100), ...tapAt(0, 200), ...tapAt(0, 300));
    expect(endings(taps)).toEqual(['tap', 'double-tap', 'tap', 'double-tap']);
  });
});

describe('long presses', () => {
  it('AC a touch or pen press held 500 ms without a drag is a long press, then a release', () => {
    const { feed, take, scheduler } = recogniserHarness();
    feed(down(20, 30, { pointer: 'touch' }), move(24, 30, { pointer: 'touch' }));
    scheduler.advance(499);
    expect(take()).toEqual([]);
    scheduler.advance(1);
    expect(take()).toEqual([{ type: 'long-press', at: { x: 20, y: 30 }, pointer: 'touch' }]);
    expect(typesOf(feed(up(24, 30, { pointer: 'touch', time: 100 })))).toEqual(['release']);
  });

  it('AC a drag, a release or a mouse never becomes a long press', () => {
    const { feed, take, scheduler } = recogniserHarness();
    feed(down(0, 0, { pointer: 'pen' }), move(4, 0, { pointer: 'pen' }));
    feed(
      up(4, 0, { pointer: 'pen' }),
      down(0, 0, { pointer: 'touch' }),
      up(0, 0, { pointer: 'touch' }),
    );
    feed(down(0, 0));
    expect(scheduler.pending()).toBe(0);
    scheduler.advance(1_000);
    expect(take()).toEqual([]);
  });
});

describe('a press held after a drag, and other pointers', () => {
  it('AC a press that became a drag never becomes a long press, however long it is held', () => {
    const { feed, take, scheduler } = recogniserHarness();
    feed(down(0, 0, { pointer: 'touch' }), move(10, 0, { pointer: 'touch' }));
    scheduler.advance(1_000);
    expect(take()).toEqual([]);
    expect(typesOf(feed(up(10, 0, { pointer: 'touch', time: 1_000 })))).toEqual(['release']);
  });

  it('leaves the press as it is when another pointer that it never saw pressed is released', () => {
    const { feed } = recogniserHarness();
    feed(down(0, 0));
    expect(feed(up(5, 5, { id: 2, pointer: 'pen' }))).toEqual([]);
    expect(typesOf(feed(move(10, 0)))).toEqual(['drag-start']);
  });
});

describe('camera drags', () => {
  it('REQ-V06 a middle-button drag pans by exactly the pointer delta and never reaches the tool', () => {
    const { feed } = recogniserHarness();
    const middle = { button: 'middle' } as const;
    expect(feed(down(10, 10, middle))).toEqual([]);
    expect(feed(move(11, 10, middle), move(30, 25, middle), up(40, 20, middle))).toEqual([
      { type: 'pan', delta: { x: 1, y: 0 } },
      { type: 'pan', delta: { x: 19, y: 15 } },
      { type: 'pan', delta: { x: 10, y: -5 } },
    ]);
  });

  it('REQ-V06 a primary drag while Space is held pans, and a press after Space is the tool’s', () => {
    const { feed } = recogniserHarness();
    feed(keyEvent('key-down', ' ', 'Space'));
    expect(feed(down(0, 0), move(-100, -50), move(-100, -50), up(-100, -50))).toEqual([
      { type: 'pan', delta: { x: -100, y: -50 } },
    ]);
    feed(keyEvent('key-up', ' ', 'Space'));
    expect(typesOf(feed(down(0, 0)))).toEqual(['press']);
  });

  it('REQ-C11 ignores a pointer it never saw pressed, such as one pressed on the tool bar', () => {
    const { feed } = recogniserHarness();
    expect(feed(move(10, 10), move(60, 10), up(60, 10))).toEqual([]);
  });
});
