import { describe, expect, it } from 'vitest';

import { DEFAULT_FILE_SIZE_LIMITS, findFileSizeViolations } from '../lib/file-size.ts';

const { maxBytes, maxSourceLines } = DEFAULT_FILE_SIZE_LIMITS;

describe('findFileSizeViolations', () => {
  it('accepts files within the limits', () => {
    expect(
      findFileSizeViolations([{ path: 'src/a.ts', bytes: maxBytes, lines: maxSourceLines }]),
    ).toEqual([]);
  });

  it('reports oversized files and long source files', () => {
    expect(
      findFileSizeViolations([
        { path: 'assets/big.png', bytes: maxBytes + 1, lines: 1 },
        { path: 'src/long.tsx', bytes: 10, lines: maxSourceLines + 1 },
      ]),
    ).toEqual([
      `assets/big.png: ${String(maxBytes + 1)} bytes exceeds the ${String(maxBytes)}-byte limit`,
      `src/long.tsx: ${String(maxSourceLines + 1)} lines exceeds the ${String(maxSourceLines)}-line limit`,
    ]);
  });

  it('does not apply the line limit to non-source files or exempt files', () => {
    expect(
      findFileSizeViolations([
        { path: 'docs/long.md', bytes: 10, lines: maxSourceLines + 1 },
        { path: 'package-lock.json', bytes: maxBytes * 10, lines: 100_000 },
      ]),
    ).toEqual([]);
  });
});
