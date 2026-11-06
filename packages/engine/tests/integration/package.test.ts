import { describe, expect, it } from 'vitest';

describe('the @planewright/engine workspace', () => {
  it('resolves its package name to the source entry point', async () => {
    const byName = await import('@planewright/engine');
    const byPath = await import('../../src/index.ts');
    expect(byName).toBe(byPath);
  });
});
