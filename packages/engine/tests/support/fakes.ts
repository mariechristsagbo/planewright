import type { Cancel, Clock, IdSource, Scheduler } from '../../src/index.ts';
import type { TextMeasurer } from '../../src/geometry/text-measurer.ts';

/** A clock that moves only when the test advances it. */
export interface ManualClock extends Clock {
  advance(ms: number): void;
}

/** A scheduler whose queues run only when the test says so. */
export interface QueueScheduler extends Scheduler {
  /** Advances the clock, running each delayed task at its due time, earliest and oldest first. */
  advance(ms: number): void;
  /** Runs the frame tasks queued so far with the clock's time; tasks they queue wait a frame. */
  frame(): void;
  /** How many delayed and frame tasks are still queued. */
  pending(): number;
}

interface Delayed {
  readonly due: number;
  readonly run: () => void;
}

interface Frame {
  readonly run: (time: number) => void;
}

export function createManualClock(start = 0): ManualClock {
  let time = start;
  return {
    now: () => time,
    advance(ms) {
      if (!(ms >= 0)) {
        throw new RangeError(`A manual clock cannot advance by ${String(ms)} ms.`);
      }
      time += ms;
    },
  };
}

function queue<T>(items: Set<T>, item: T): Cancel {
  items.add(item);
  return () => {
    items.delete(item);
  };
}

/** The delayed task to run next, if one is due by `limit`; ties go to the older task. */
function nextDue(delayed: ReadonlySet<Delayed>, limit: number): Delayed | undefined {
  let next: Delayed | undefined;
  for (const entry of delayed) {
    if (entry.due <= limit && (next === undefined || entry.due < next.due)) {
      next = entry;
    }
  }
  return next;
}

export function createQueueScheduler(clock: ManualClock): QueueScheduler {
  const delayed = new Set<Delayed>();
  let frames = new Set<Frame>();
  return {
    after: (delayMs, task) =>
      queue(delayed, { due: clock.now() + Math.max(0, delayMs), run: task }),
    nextFrame: (task) => queue(frames, { run: task }),
    advance(ms) {
      const target = clock.now() + ms;
      for (let next = nextDue(delayed, target); next; next = nextDue(delayed, target)) {
        delayed.delete(next);
        clock.advance(next.due - clock.now());
        next.run();
      }
      clock.advance(target - clock.now());
    },
    frame() {
      const due = frames;
      frames = new Set();
      for (const { run } of due) {
        run(clock.now());
      }
    },
    pending: () => delayed.size + frames.size,
  };
}

/** Identifiers 1, 2, 3… written as 22 decimal digits, which are base64url characters too. */
export function createCountingIds(): IdSource {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return String(count).padStart(22, '0');
    },
  };
}

/** How many code points a string holds: a surrogate pair counts once. */
const codePoints = (text: string): number =>
  text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length;

/**
 * A measurer that gives every code point the same advance, `advance` units at size 20 and in
 * proportion at other sizes, with an ascent of 0.8 and a descent of 0.2 of the size.
 */
export function createFixedAdvanceMeasurer(advance = 10): TextMeasurer {
  return {
    measure: (text, font) => ({
      width: (codePoints(text) * advance * font.size) / 20,
      ascent: 0.8 * font.size,
      descent: 0.2 * font.size,
    }),
  };
}
