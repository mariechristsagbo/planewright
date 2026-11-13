import { mkdirSync, writeFileSync } from 'node:fs';

import type { Browser } from '@playwright/test';

import {
  TRACE_CATEGORIES,
  refusedTrace,
  traceEventsOf,
  traceFiles,
  traceFrames,
} from '../../../../scripts/lib/perf-trace.ts';
import { readControlRecord } from '../../../../scripts/lib/perf-passes.ts';
import type { ControlRecord } from '../../../../scripts/lib/perf-passes.ts';
import type {
  MeasuredFrame,
  TraceRecord,
  TracedFrame,
} from '../../../../scripts/lib/perf-trace.ts';
import { tracesFolder } from './results.ts';
import { CPU_SLOWDOWN } from './support.ts';

// A traced pass of the browser measurements and its paired control
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): Chromium traces
// the whole browser while a pass measures its frames, and the pass keeps the trace beside a record
// of those frames, each with its start on the page's clock and in the trace, once the trace is
// checked to hold exactly its warm-up and those frames; a trace that the check refuses is kept
// under another name with the reason, which the report never reads, and the pass fails. The same
// pass then runs once more untraced, its control, whose record sits beside the trace. Neither
// pass's frames are a budget's samples, since tracing adds work to the frames it records.

export interface TracedPass {
  /** The budget whose measurement the pass repeats. */
  readonly id: string;
  readonly warmUp: number;
  readonly details: Readonly<Record<string, unknown>>;
}

/**
 * Runs `measure` while Chromium traces the browser, stopping the trace even when it fails, and
 * writes the trace and the record of the frames it measured, refusing a trace that lacks one.
 */
export async function traced(
  browser: Browser,
  pass: TracedPass,
  measure: () => Promise<readonly MeasuredFrame[]>,
): Promise<TracedFrame[]> {
  await browser.startTracing(undefined, { categories: [...TRACE_CATEGORIES] });
  let measured: readonly MeasuredFrame[];
  try {
    measured = await measure();
  } catch (error) {
    await browser.stopTracing();
    throw error;
  }
  const trace = await browser.stopTracing();
  const files = traceFiles(pass.id);
  const folder = tracesFolder(CPU_SLOWDOWN);
  const given = {
    warmUp: pass.warmUp,
    frames: measured.map(({ start, duration }) => ({ start, duration })),
  };
  let frames: TracedFrame[];
  try {
    frames = traceFrames(
      traceEventsOf(JSON.parse(trace.toString('utf8')), files.trace),
      given,
      files.trace,
    );
  } catch (error) {
    const refused = refusedTrace(pass.id, given, error);
    mkdirSync(folder, { recursive: true });
    writeFileSync(`${folder}${files.refusedTrace}`, trace);
    writeFileSync(`${folder}${files.refused}`, `${JSON.stringify(refused, null, 2)}\n`);
    throw error;
  }
  const record: TraceRecord = {
    ...{ id: pass.id, pass: 'traced', trace: files.trace, categories: TRACE_CATEGORIES },
    ...{ warmUp: pass.warmUp, frames },
    details: {
      ...pass.details,
      browser: `Chromium ${browser.version()}`,
      cpuSlowdown: CPU_SLOWDOWN,
    },
  };
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}${files.trace}`, trace);
  writeFileSync(`${folder}${files.record}`, `${JSON.stringify(record, null, 2)}\n`);
  return frames;
}

/**
 * Writes the record of the traced pass's paired control: the same pass run again untraced, its
 * frames on the page's clock, beside the trace.
 */
export function writeControl(
  browser: Browser,
  pass: TracedPass,
  measured: readonly MeasuredFrame[],
): ControlRecord {
  const name = traceFiles(pass.id).control;
  const record = readControlRecord(
    {
      ...{ id: pass.id, pass: 'control', warmUp: pass.warmUp },
      frames: measured.map(({ start, duration }) => ({ start, duration })),
      details: {
        ...pass.details,
        browser: `Chromium ${browser.version()}`,
        cpuSlowdown: CPU_SLOWDOWN,
      },
    },
    name,
  );
  const folder = tracesFolder(CPU_SLOWDOWN);
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}${name}`, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
