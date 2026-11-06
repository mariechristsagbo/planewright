/**
 * The ports that need no model types (docs/architecture/engine/modules.md#ports). The engine
 * reaches the platform only through them, so its clock, timers and identifiers can be replaced by
 * deterministic fakes in tests. The other ports live in the lowest layer whose types they need.
 */

/** The current time. */
export interface Clock {
  /** Milliseconds from an arbitrary origin; the web app uses `performance.now()`. */
  now(): number;
}

/** Stops a scheduled task; calling it again, or after the task ran, does nothing. */
export type Cancel = () => void;

/** Runs tasks later. */
export interface Scheduler {
  /** Runs a task once, after a delay in milliseconds. */
  after(delayMs: number, task: () => void): Cancel;
  /** Runs a task before the next frame is drawn, with that frame's time in milliseconds. */
  nextFrame(task: (time: number) => void): Cancel;
}

/** New identifiers: 128 random bits written as 22 base64url characters. */
export interface IdSource {
  next(): string;
}
