import { describe, expect, it } from 'vitest';

import { loadFonts } from '../../src/platform/fonts.ts';

// The page loads the bundled fonts before it creates the editor (ADR 0011), so that the first text
// is measured in its font; a font that fails to load leaves its generic fallback.

describe('loading the bundled fonts', () => {
  it('asks for the face of each family', async () => {
    const asked: string[] = [];
    await loadFonts({
      load: (font) => {
        asked.push(font);
        return Promise.resolve([]);
      },
    });
    expect(asked).toEqual([
      '20px "Planewright Sans", sans-serif',
      '20px "Planewright Hand", cursive',
      '20px "Planewright Mono", monospace',
    ]);
  });

  it('settles when a font fails to load, so the page still starts', async () => {
    const loader = {
      load: (font: string) =>
        font.includes('Hand') ? Promise.reject(new Error('offline')) : Promise.resolve([]),
    };
    await expect(loadFonts(loader)).resolves.toBeUndefined();
  });
});
