import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import config from '../../apps/web/playwright.perf.config.ts';
import { clearResults, resultsFolder, tracesFolder } from '../../apps/web/tests/perf/results.ts';

// The browser measurements' files (docs/architecture/engine/quality.md#what-issue-38-decided):
// `npm run perf:browser` removes the files of an earlier run before it measures, so that the
// report never reads a measurement that a failing test did not write again (the ENG-15 review's
// s3), and its traces with them
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided).

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('the browser measurements folder', () => {
  it('is perf-results/browser, or one per CPU slowdown for the low-end check', () => {
    expect(resultsFolder(1).endsWith('/perf-results/browser/')).toBe(true);
    expect(resultsFolder(4).endsWith('/perf-results/browser-cpu-4x/')).toBe(true);
    expect(resultsFolder(1).startsWith('/')).toBe(true);
  });

  it('keeps the traces in a folder of its own inside it, which the report never reads as a measurement', () => {
    expect(tracesFolder(1)).toBe(`${resultsFolder(1)}traces/`);
    expect(tracesFolder(4)).toBe(`${resultsFolder(4)}traces/`);
  });

  it('loses every earlier measurement and trace when cleared, and clearing a missing one is no error', () => {
    const root = mkdtempSync(join(tmpdir(), 'planewright-perf-'));
    folders.push(root);
    const folder = join(root, 'browser');
    mkdirSync(join(folder, 'traces'), { recursive: true });
    writeFileSync(join(folder, 'B1.json'), '{"id":"B1","samples":[1]}\n');
    writeFileSync(join(folder, 'traces', 'B1.trace.json'), '{"traceEvents":[]}\n');
    clearResults(folder);
    expect(existsSync(folder)).toBe(false);
    expect(() => {
      clearResults(folder);
    }).not.toThrow();
  });

  it('is cleared by the browser measurements before their first test', () => {
    expect(config.globalSetup).toBe('./tests/perf/global-setup.ts');
  });
});
