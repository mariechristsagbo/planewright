import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import config from '../../apps/web/playwright.perf.config.ts';
import { clearResults, resultsFolder } from '../../apps/web/tests/perf/results.ts';

// The browser measurements' files (docs/architecture/engine/quality.md#what-issue-38-decided):
// `npm run perf:browser` removes the files of an earlier run before it measures, so that the
// report never reads a measurement that a failing test did not write again (the ENG-15 review's
// s3).

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

  it('loses every earlier measurement when cleared, and clearing a missing one is no error', () => {
    const root = mkdtempSync(join(tmpdir(), 'planewright-perf-'));
    folders.push(root);
    const folder = join(root, 'browser');
    mkdirSync(folder);
    writeFileSync(join(folder, 'B1.json'), '{"id":"B1","samples":[1]}\n');
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
