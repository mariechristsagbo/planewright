import { describe, expect, it } from 'vitest';

import * as brand from '../../../src/model/brand.ts';

describe('the brand', () => {
  it('keeps its symbol private, so that only the model can create branded values', () => {
    expect(Object.keys(brand)).toEqual([]);
  });
});
