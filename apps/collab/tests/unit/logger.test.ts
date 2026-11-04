import { afterEach, describe, expect, it, vi } from 'vitest';

import { jsonLogger } from '../../src/logger.ts';

describe('jsonLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes one JSON object per line with a timestamp, the event and its fields', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    jsonLogger('collab.listening', { port: 8787 });
    jsonLogger('collab.stopping');

    const lines = write.mock.calls.map(([chunk]) => String(chunk));
    expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
    const [first, second] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(first).toMatchObject({ event: 'collab.listening', port: 8787 });
    expect(second).toMatchObject({ event: 'collab.stopping' });
    expect(Number.isNaN(Date.parse(String(first?.['time'])))).toBe(false);
  });
});
