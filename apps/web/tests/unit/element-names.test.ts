import type { Element } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { elementName, elementRow } from '../../src/a11y/element-names.ts';
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

  it('REQ-Y05 names a text as its whole words would, reading only as far as the cut', () => {
    // What the name held when it processed the whole text (ENG-14), for comparison.
    const whole = (text: string): string => {
      const words = text.replace(/\s+/gu, ' ').trim();
      return words.length > 40 ? `${words.slice(0, 40)}…` : words;
    };
    const texts = [
      '',
      '   \n\t ',
      'a',
      ' a\u00a0b\u2028c ',
      'x'.repeat(40),
      'x'.repeat(41),
      `${'x'.repeat(40)}   \n `,
      `${'x'.repeat(39)} y`,
      `${'x'.repeat(40)} y`,
      `${'w '.repeat(19)}w  \n\n z`,
      '😀'.repeat(25),
      `${'a'.repeat(39)}😀b`,
      `${' '.repeat(99_999)}z`,
      'word '.repeat(20_000),
      'x'.repeat(100_000),
    ];
    const written = drawn('tool.text');
    if (written.kind !== 'text') throw new Error('The text tool drew no text.');
    for (const text of texts) {
      const element = { ...written, content: { ...written.content, text } };
      expect(elementName(element).split('”, ')[0]).toBe(`Text “${whole(text)}`);
    }
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

  it('D4 A6 gives a row its kind, or a text’s words, as its label, and its size, place and turn as figures', () => {
    const rectangle = drawn('tool.rectangle');
    expect(elementRow(rectangle)).toEqual({ label: 'Rectangle', metadata: '100 × 100 · 350, 250' });
    expect(elementRow({ ...rectangle, rotation: -Math.PI / 4, x: -0.04 })).toEqual({
      label: 'Rectangle',
      metadata: '100 × 100 · 0, 250 · 315°',
    });
    expect(elementRow(drawn('tool.line'))).toEqual({
      label: 'Line',
      metadata: '100 × 0 · 350, 300',
    });
    expect(elementRow(drawn('tool.freehand'))).toEqual({
      label: 'Freehand stroke',
      metadata: '0 × 0 · 400, 300',
    });
    const text = drawn('tool.text');
    expect(elementRow(text).label).toBe('“Shopping list for the week ahead, with e…”');
    expect(elementRow(text).metadata).toMatch(/^[\d.]+ × 50 · 400, 287\.5$/u);
    if (text.kind !== 'text') throw new Error('The text tool drew no text.');
    expect(elementRow({ ...text, content: { ...text.content, text: ' \n ' } }).label).toBe('Text');
  });

  it('D4 A6 shows in a row only words and figures of its name (WCAG 2.5.3, label in name)', () => {
    const rectangle = drawn('tool.rectangle');
    for (const element of [
      rectangle,
      { ...rectangle, rotation: 1, y: 12.345 },
      drawn('tool.line'),
      drawn('tool.freehand'),
      drawn('tool.text'),
    ]) {
      const name = elementName(element);
      const { label, metadata } = elementRow(element);
      expect(name).toContain(label === 'Text' ? 'Text “' : label);
      const figures: readonly string[] = name.match(/-?[\d.]+/gu) ?? [];
      expect(
        (metadata.match(/-?[\d.]+/gu) ?? []).filter((figure) => !figures.includes(figure)),
      ).toEqual([]);
    }
  });
});
