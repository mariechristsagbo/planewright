import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Cancel, Clock, IdSource, Scheduler } from '../../src/index.ts';
import { createCountingIds, createManualClock, createQueueScheduler } from '../support/fakes.ts';

describe('the port interfaces', () => {
  it('have the signatures of the architecture', () => {
    expectTypeOf<Clock['now']>().toEqualTypeOf<() => number>();
    expectTypeOf<Cancel>().toEqualTypeOf<() => void>();
    expectTypeOf<Scheduler['after']>().toEqualTypeOf<
      (delayMs: number, task: () => void) => Cancel
    >();
    expectTypeOf<Scheduler['nextFrame']>().toEqualTypeOf<
      (task: (time: number) => void) => Cancel
    >();
    expectTypeOf<IdSource['next']>().toEqualTypeOf<() => string>();
  });
});

describe('the manual clock', () => {
  it('starts at the given time and moves only when advanced', () => {
    const clock: Clock & { advance(ms: number): void } = createManualClock(1_000);
    expect(clock.now()).toBe(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
  });

  it('starts at zero by default and never goes back', () => {
    const clock = createManualClock();
    expect(clock.now()).toBe(0);
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
    expect(() => {
      clock.advance(Number.NaN);
    }).toThrow(RangeError);
  });
});

describe('the queue scheduler', () => {
  it('runs delayed tasks at their due time, earliest and oldest first, as the test advances', () => {
    const clock = createManualClock();
    const scheduler = createQueueScheduler(clock);
    const asScheduler: Scheduler = scheduler;
    const ran: string[] = [];
    asScheduler.after(300, () => ran.push(`b at ${String(clock.now())}`));
    asScheduler.after(100, () => ran.push(`a at ${String(clock.now())}`));
    asScheduler.after(300, () => ran.push(`c at ${String(clock.now())}`));
    asScheduler.after(-5, () => ran.push(`now at ${String(clock.now())}`));
    scheduler.advance(299);
    expect(ran).toEqual(['now at 0', 'a at 100']);
    expect(clock.now()).toBe(299);
    scheduler.advance(1);
    expect(ran).toEqual(['now at 0', 'a at 100', 'b at 300', 'c at 300']);
    expect(() => {
      scheduler.advance(-1);
    }).toThrow(RangeError);
  });

  it('runs a task that a task schedules once the clock reaches it', () => {
    const clock = createManualClock();
    const scheduler = createQueueScheduler(clock);
    const ran: number[] = [];
    scheduler.after(10, () => {
      ran.push(clock.now());
      scheduler.after(10, () => ran.push(clock.now()));
    });
    scheduler.advance(30);
    expect(ran).toEqual([10, 20]);
    expect(clock.now()).toBe(30);
  });

  it('never runs a cancelled task, and cancelling twice is harmless', () => {
    const clock = createManualClock();
    const scheduler = createQueueScheduler(clock);
    const ran: string[] = [];
    const cancel = scheduler.after(10, () => ran.push('cancelled'));
    scheduler.after(10, () => ran.push('kept'));
    cancel();
    cancel();
    scheduler.advance(10);
    expect(ran).toEqual(['kept']);
    expect(scheduler.pending()).toBe(0);
  });

  it('runs the queued frame tasks with the clock time when the test renders a frame', () => {
    const clock = createManualClock(16);
    const scheduler = createQueueScheduler(clock);
    const frames: number[] = [];
    scheduler.nextFrame((time) => {
      frames.push(time);
      scheduler.nextFrame((later) => frames.push(later));
    });
    const cancel = scheduler.nextFrame(() => frames.push(-1));
    scheduler.nextFrame(() => {
      cancelLater();
    });
    const cancelLater = scheduler.nextFrame(() => frames.push(-2));
    cancel();
    scheduler.frame();
    expect(frames).toEqual([16]);
    clock.advance(16);
    scheduler.frame();
    expect(frames).toEqual([16, 32]);
    expect(scheduler.pending()).toBe(0);
  });
});

describe('the counting identifier source', () => {
  it('gives distinct identifiers of 22 base64url characters in a fixed sequence', () => {
    const ids: IdSource = createCountingIds();
    const first = [ids.next(), ids.next(), ids.next()];
    expect(first).toEqual([
      '0000000000000000000001',
      '0000000000000000000002',
      '0000000000000000000003',
    ]);
    expect(createCountingIds().next()).toBe(first[0]);
    for (const id of first) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/u);
    }
  });
});
