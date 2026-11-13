import type { MeasuredFrame } from './perf-trace.ts';

/**
 * B1's passes (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
 * browser measurements pan B1's scene three times in one job, each pass on a page of its own with
 * the same warm-up and measured pans. The budget pass, which no trace slows, gives B1's samples;
 * the traced pass runs while Chromium traces the browser, and its trace holds exactly its frames;
 * its paired control runs untraced right after it. Only the budget pass is B1's measurement: the
 * trace explains the traced pass's own frames, and the control sets tracing's effect beside the
 * spread of untraced passes. This module reads the control's record.
 */

/** The record of the traced pass's paired control, beside the trace. */
export interface ControlRecord {
  /** The budget whose pans the control ran again. */
  readonly id: string;
  readonly pass: 'control';
  readonly warmUp: number;
  readonly frames: readonly MeasuredFrame[];
  readonly details?: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFrame = (value: unknown): value is MeasuredFrame =>
  isRecord(value) && ['start', 'duration'].every((field) => Number.isFinite(value[field]));

const isCount = (value: unknown): boolean => Number.isInteger(value) && Number(value) >= 0;

const isFrameList = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(isFrame);

/** A paired control's record, refusing a malformed one or one that names a trace. */
export function readControlRecord(value: unknown, file: string): ControlRecord {
  const { id, pass, trace, warmUp, frames, details } = isRecord(value) ? value : {};
  const valid =
    typeof id === 'string' &&
    pass === 'control' &&
    trace === undefined &&
    isCount(warmUp) &&
    isFrameList(frames) &&
    (details === undefined || isRecord(details));
  if (!valid) {
    throw new Error(
      `${file} is not the record of a paired control: it needs an id, the control pass, a warm-up and frames, and no trace.`,
    );
  }
  return value as ControlRecord;
}
