import { describe, expect, it } from 'vitest';

import * as engine from '../../src/index.ts';

describe('the engine entry point', () => {
  it('exports no run-time value: the layers stay internal until the editor exists', () => {
    expect(Object.keys(engine)).toEqual([]);
  });
});
