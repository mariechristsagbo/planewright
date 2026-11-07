import { describe, expect, it } from 'vitest';

// The first import transforms every engine module the entry reaches, the editor and all its layers
// since ENG-08: 5.2 s cold on its own under coverage, more in the parallel run.
const COLD_IMPORT_MS = 30_000;

describe('the @planewright/engine workspace', () => {
  it(
    'resolves its package name to the source entry point',
    { timeout: COLD_IMPORT_MS },
    async () => {
      const byName = await import('@planewright/engine');
      const byPath = await import('../../src/index.ts');
      expect(byName).toBe(byPath);
    },
  );
});
