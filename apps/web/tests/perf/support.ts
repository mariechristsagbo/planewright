import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

import { perfArea, perfRecords } from '../../../../packages/engine/tests/support/perf-scenes.ts';
import type { PerfSceneSpec } from '../../../../packages/engine/tests/support/perf-scenes.ts';
import { canvas, canvasBox } from '../e2e/support.ts';

// What the browser measurements share (docs/architecture/engine/quality.md#what-eng-15-decided):
// a seeded drawing stored in the page's IndexedDB as a whole save writes it, the page opened with
// `?measure` so that each render is a `performance.measure`, probes that the page installs before
// its own scripts, and the measurement files that the performance report reads. Page code is
// written as strings, since these files compile without the DOM library.

export const DOCUMENT_ID = 'PerfMeasuredDocument00';

/** A CPU slowdown for the low-end check (B15), from PERF_CPU_SLOWDOWN; 1 in CI. */
export const CPU_SLOWDOWN = Number(process.env['PERF_CPU_SLOWDOWN'] ?? '1');

const RESULTS = fileURLToPath(
  new URL(
    `../../../../perf-results/${CPU_SLOWDOWN === 1 ? 'browser' : `browser-cpu-${String(CPU_SLOWDOWN)}x`}/`,
    import.meta.url,
  ),
);

/**
 * Probes installed before the page's scripts: the start of each animation frame, from the first
 * callback that runs in it; the time of each pointer move, from a capturing listener that runs
 * before the canvas's own; the page's long tasks; and how many scene renders the page measured,
 * with `afterScene(count)`, which resolves in the animation frame after the render that passes
 * `count`, waiting on the timeline rather than polling, so that no extra frame is drawn.
 */
export const PROBES = `(() => {
  const probes = { frames: [], moves: [], longTasks: [], scenes: 0, waiting: [] };
  window.perfProbes = probes;
  new PerformanceObserver((list) => {
    probes.scenes += list.getEntriesByName('planewright:render-scene').length;
    for (const wake of probes.waiting.splice(0)) wake();
  }).observe({ type: 'measure' });
  probes.afterScene = (count) => new Promise((resolve) => {
    const check = () => probes.scenes > count ? requestAnimationFrame(() => resolve()) : probes.waiting.push(check);
    check();
  });
  const request = window.requestAnimationFrame.bind(window);
  let last = -1;
  window.requestAnimationFrame = (callback) => request((time) => {
    if (time !== last) { last = time; probes.frames.push(performance.now()); }
    callback(time);
  });
  window.addEventListener('pointermove', () => probes.moves.push(performance.now()), { capture: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) probes.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
})();`;

export interface Measure {
  readonly name: string;
  readonly start: number;
  readonly duration: number;
  readonly elements: number;
}

/** Every render that the page has measured since it was opened or last cleared. */
export const measures = (page: Page): Promise<Measure[]> =>
  page.evaluate<Measure[]>(`performance.getEntriesByType('measure')
    .filter((entry) => entry.name.startsWith('planewright:render-'))
    .map((entry) => ({ name: entry.name.slice(19), start: entry.startTime, duration: entry.duration, elements: entry.detail.elements }))`);

export const clearMeasures = (page: Page): Promise<unknown> =>
  page.evaluate('performance.clearMeasures()');

/** How many renders of the layer the page has measured. */
export const rendered = (page: Page, layer: string): Promise<number> =>
  page.evaluate<number>(`performance.getEntriesByName('planewright:render-${layer}').length`);

/** Waits until the page has measured more than `count` renders of the layer. */
export async function waitForRenders(page: Page, layer: string, count: number): Promise<void> {
  await page.waitForFunction(
    `performance.getEntriesByName('planewright:render-${layer}').length > ${String(count)}`,
  );
}

/** Opens the page without a drawing and gives the scene canvas's size in CSS pixels. */
export async function openEmpty(page: Page): Promise<{ width: number; height: number }> {
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  const { width, height } = await canvasBox(page);
  return { width, height };
}

/** The area a seeded scene covers for `fraction` of it in view at zoom 1 from the origin. */
export const areaFor = (view: { width: number; height: number }, fraction: number) =>
  perfArea(view, { x: 0, y: 0, zoom: 1 }, fraction);

/** Stores a scene as a whole save writes it, with its session, in the page's IndexedDB. */
export async function storeScene(
  page: Page,
  spec: PerfSceneSpec,
  selection: readonly string[] = [],
): Promise<void> {
  const session = { camera: { x: 0, y: 0, zoom: 1 }, selection: selection as never[] };
  const { record, elements } = perfRecords(spec, { id: DOCUMENT_ID, session });
  await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('planewright');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['documents', 'elements'], 'readwrite');
      transaction.objectStore('documents').put({ ...${JSON.stringify(record)}, updated: Date.now() });
      const store = transaction.objectStore('elements');
      for (const element of ${JSON.stringify(elements)}) store.put(element);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);
}

/**
 * Opens the page to measure its frames and waits for the first render that draws the stored
 * drawing's `visible` elements; with a CPU slowdown asked for, slows the page down from then on.
 */
export async function openMeasured(page: Page, visible: number): Promise<CDPSession> {
  await page.goto('/?measure');
  await page.waitForFunction(
    `performance.getEntriesByName('planewright:render-scene').some((entry) => entry.detail.elements === ${String(visible)})`,
  );
  const session = await page.context().newCDPSession(page);
  if (CPU_SLOWDOWN !== 1) {
    await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  }
  return session;
}

/** The main thread's busy time so far, in milliseconds, from Chromium's performance metrics. */
export async function taskTime(session: CDPSession): Promise<number> {
  const { metrics } = await session.send('Performance.getMetrics');
  const found = metrics.find(({ name }) => name === 'TaskDuration');
  if (found === undefined) throw new Error('Chromium reports no TaskDuration.');
  return found.value * 1000;
}

/** Waits for two more animation frames, so that a frame and what React commits after it are done. */
export const settle = (page: Page): Promise<unknown> =>
  page.evaluate(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );

export interface MeasurementFile {
  readonly id: string;
  readonly samples: readonly number[];
  readonly details: Readonly<Record<string, unknown>>;
}

/** Writes a measurement for the performance report, with the browser and the slowdown. */
export function writeMeasurement(page: Page, measurement: MeasurementFile): void {
  const browser = `Chromium ${page.context().browser()?.version() ?? 'unknown'}`;
  const details = { ...measurement.details, browser, cpuSlowdown: CPU_SLOWDOWN };
  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(
    `${RESULTS}${measurement.id}.json`,
    `${JSON.stringify({ ...measurement, details }, null, 2)}\n`,
  );
}
