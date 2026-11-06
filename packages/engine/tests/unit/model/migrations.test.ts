import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrate } from '../../../src/model/migrations.ts';
import type { Migration } from '../../../src/model/migrations.ts';
import { CURRENT_SCHEMA } from '../../../src/model/schema.ts';

// Two made-up steps: schema 1 calls the canvas "paper", and schema 2 calls its colour "tint".
const steps: readonly Migration[] = [
  ({ paper, ...rest }) => ({ ...rest, canvas: paper }),
  (document) => {
    const canvas = document['canvas'] as { tint: string };
    return { ...document, canvas: { background: canvas.tint } };
  },
];

describe('the migrations', () => {
  it('start with none: schema 1 is the current schema', () => {
    expect(MIGRATIONS).toEqual([]);
    expect(CURRENT_SCHEMA).toBe(MIGRATIONS.length + 1);
  });

  it('run one step at a time from the document schema and write each new number', () => {
    const old = { format: 'planewright', schema: 1, paper: { tint: '#ffffff' }, elements: [] };
    expect(migrate(old, 1, steps)).toStrictEqual({
      format: 'planewright',
      schema: 3,
      elements: [],
      canvas: { background: '#ffffff' },
    });
    const newer = { format: 'planewright', schema: 2, canvas: { tint: '#000000' } };
    expect(migrate(newer, 2, steps)).toStrictEqual({
      ...newer,
      schema: 3,
      canvas: { background: '#000000' },
    });
  });

  it('leave a document of the current schema as it is', () => {
    const current = { format: 'planewright', schema: 3 };
    expect(migrate(current, 3, steps)).toBe(current);
    expect(migrate(current, 1, MIGRATIONS)).toBe(current);
  });
});
