import type { Element } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { elementName } from '../../src/a11y/element-names.ts';
import { surfaceHarness } from '../support/surface.tsx';

// How the element list names an element (docs/architecture/engine/quality.md#accessibility,
// REQ-Y05): by kind, text and geometry, as in "Rectangle, 120 by 100, at 300, 180".

/** An element drawn with a tool by Enter at the centre of an 800 × 600 canvas, (400, 300). */
function drawn(tool: 'tool.rectangle' | 'tool.line' | 'tool.freehand' | 'tool.text'): Element {
  const { editor } = surfaceHarness();
  editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  editor.run(tool);
  editor.run('canvas.enter');
  editor.editText({
    type: 'value',
    text: '  Shopping\nlist\tfor   the week ahead, with everything we need ',
  });
  editor.editText({ type: 'commit' });
  const [element] = editor.view.elements;
  if (element === undefined) throw new Error(`${tool} drew nothing.`);
  return element;
}

describe('the names of elements', () => {
  it('REQ-Y05 names a shape by its kind, its size and its position', () => {
    const rectangle = drawn('tool.rectangle');
    expect(elementName(rectangle)).toBe('Rectangle, 100 by 100, at 350, 250');
    if (rectangle.kind !== 'rectangle') throw new Error('The rectangle tool drew no rectangle.');
    expect(elementName({ ...rectangle, kind: 'diamond', x: -0.04, y: 12.345 })).toBe(
      'Diamond, 100 by 100, at 0, 12.3',
    );
  });

  it('REQ-Y05 names lines and freehand strokes by the box of their points', () => {
    expect(elementName(drawn('tool.line'))).toBe('Line, 100 by 0, at 350, 300');
    expect(elementName(drawn('tool.freehand'))).toBe('Freehand stroke, 0 by 0, at 400, 300');
  });

  it('REQ-Y05 names a text by its words, on one line and at most 40 characters', () => {
    expect(elementName(drawn('tool.text'))).toMatch(
      /^Text “Shopping list for the week ahead, with e…”, [\d.]+ by 50, at 400, 287\.5$/u,
    );
  });

  it('REQ-Y05 says how far an element is turned, in whole and tenth degrees', () => {
    const rectangle = drawn('tool.rectangle');
    expect(elementName({ ...rectangle, rotation: Math.PI / 4 })).toBe(
      'Rectangle, 100 by 100, at 350, 250, turned 45 degrees',
    );
    expect(elementName({ ...rectangle, rotation: -Math.PI / 2 })).toMatch(/turned 270 degrees$/u);
    expect(elementName({ ...rectangle, rotation: 1e-9 })).toBe(
      'Rectangle, 100 by 100, at 350, 250',
    );
  });
});
