import { createEditor } from '@planewright/engine';
import type { FontSpec } from '@planewright/engine';
import { describe, expect, it, vi } from 'vitest';

import { canvasRenderer } from '../../src/editor/renderer.ts';
import { browserPorts } from '../../src/platform/ports.ts';
import type { BrowserPage } from '../../src/platform/ports.ts';
import { canvasTextMeasurer } from '../../src/platform/text-measurer.ts';

// The editor's ports over the browser (docs/architecture/engine/modules.md#ports) and the text
// measurer that the canvas renderer lays texts out with.

function fakePage(bytes: (index: number) => number): BrowserPage {
  return {
    performance: { now: () => 42.5 },
    setTimeout: vi.fn(() => 11),
    clearTimeout: vi.fn(),
    requestAnimationFrame: vi.fn(() => 22),
    cancelAnimationFrame: vi.fn(),
    btoa: (text) => btoa(text),
    crypto: {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) array.forEach((_, index) => (array[index] = bytes(index)));
        return array;
      },
    },
  };
}

describe('the browser ports', () => {
  it('read the page clock, and schedule and cancel timers and animation frames', () => {
    const page = fakePage(() => 0);
    const { clock, scheduler } = browserPorts(page);
    expect(clock.now()).toBe(42.5);
    const task = () => undefined;
    scheduler.after(500, task)();
    expect(page.setTimeout).toHaveBeenCalledWith(task, 500);
    expect(page.clearTimeout).toHaveBeenCalledWith(11);
    scheduler.nextFrame(task)();
    expect(page.requestAnimationFrame).toHaveBeenCalledWith(task);
    expect(page.cancelAnimationFrame).toHaveBeenCalledWith(22);
  });

  it('write 128 random bits as 22 base64url characters', () => {
    expect(browserPorts(fakePage((index) => index)).ids.next()).toBe('AAECAwQFBgcICQoLDA0ODw');
    expect(browserPorts(fakePage(() => 255)).ids.next()).toBe('_____________________w');
    expect(browserPorts(fakePage((index) => 0xfb - index)).ids.next()).toMatch(/^[\w-]{22}$/u);
  });

  it('are enough for an editor', () => {
    const editor = createEditor(browserPorts(fakePage((index) => index * 7)));
    expect(editor.view.tool).toBe('selection');
    editor.dispose();
  });
});

describe('the canvas text measurer', () => {
  it('measures in the bundled font of each spec, with the font box’s ascent and descent', () => {
    const fonts: string[] = [];
    const context = {
      font: '',
      measureText: (text: string) => {
        fonts.push(context.font);
        return {
          width: text.length * 5,
          fontBoundingBoxAscent: 9,
          fontBoundingBoxDescent: 3,
        } as TextMetrics;
      },
    };
    const measurer = canvasTextMeasurer(context);
    const spec = (family: FontSpec['family'], size: number): FontSpec => ({
      family,
      size,
      lineHeight: 1.25,
    });
    expect(measurer.measure('abc', spec('sans', 20))).toEqual({ width: 15, ascent: 9, descent: 3 });
    measurer.measure('', spec('hand', 16));
    measurer.measure('x', spec('mono', 12.5));
    expect(fonts).toEqual([
      '20px "Planewright Sans", sans-serif',
      '16px "Planewright Hand", cursive',
      '12.5px "Planewright Mono", monospace',
    ]);
  });
});

describe('the canvas renderer factory', () => {
  const surface = (context: unknown) => ({
    width: 0,
    height: 0,
    getContext: () => context as never,
  });

  it('refuses a page that gives no 2D context to measure text with', () => {
    const page = { createElement: () => surface(null) };
    expect(() => canvasRenderer(page)(surface({}), surface({}))).toThrow(
      'This browser gave no 2D canvas context to measure text with.',
    );
  });

  it('makes a renderer over the two canvases', () => {
    const page = { createElement: () => surface({ font: '', measureText: () => ({}) }) };
    const renderer = canvasRenderer(page)(surface({}), surface({}));
    expect(typeof renderer.render).toBe('function');
    renderer.dispose();
  });
});
