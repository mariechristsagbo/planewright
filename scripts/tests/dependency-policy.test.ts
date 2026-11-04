import { describe, expect, it } from 'vitest';

import { findForbiddenPackages } from '../lib/dependency-policy.ts';

describe('findForbiddenPackages', () => {
  it('passes a lockfile without forbidden packages', () => {
    expect(
      findForbiddenPackages({
        packages: { '': { name: 'planewright' }, 'node_modules/react': { version: '19.0.0' } },
      }),
    ).toEqual([]);
  });

  it('reports scoped, unscoped and nested forbidden packages', () => {
    expect(
      findForbiddenPackages({
        packages: {
          'node_modules/@excalidraw/excalidraw': {},
          'node_modules/a/node_modules/excalidraw-utils': {},
          'node_modules/aliased': { name: 'Excalidraw' },
        },
      }),
    ).toEqual(['@excalidraw/excalidraw', 'Excalidraw', 'excalidraw-utils']);
  });

  it('rejects input that is not a v3 lockfile', () => {
    expect(() => findForbiddenPackages({ dependencies: {} })).toThrow(/lockfileVersion 3/);
  });
});
