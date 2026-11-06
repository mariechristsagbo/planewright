import { describe, expect, it } from 'vitest';

import { decodeDocument } from '../../../src/model/decode.ts';
import { fixtureJson } from '../../support/fixtures.ts';
import type { Json, JsonObject } from '../../support/fixtures.ts';
import { expectAccepted, expectRefused } from '../../support/refusals.ts';
import type { Acceptance, Refusal } from '../../support/refusals.ts';

// The remaining limits and invariants, broken once each in the valid fixture: exactly one error at
// the broken value's path and no document (REQ-P07). Elements: 0 rectangle, 3 line, 4 freehand,
// 5 text, 6 arrow, 7 note, 8 image, 9 frame.

const block = (text: string): JsonObject => ({
  text,
  font: { family: 'sans', size: 20, lineHeight: 1.25 },
  align: 'left',
});

describe('strings', () => {
  it.each<Refusal>([
    [
      'a text of 100,001 characters',
      ['elements', 5, 'content'],
      block('a'.repeat(100_001)),
      'elements[5].content.text',
      'too-long',
    ],
    [
      'a label of 100,001 characters',
      ['elements', 0, 'label'],
      block('a'.repeat(100_001)),
      'elements[0].label.text',
      'too-long',
    ],
    [
      'a text with a carriage return',
      ['elements', 5, 'content'],
      block('a\r\nb'),
      'elements[5].content.text',
      'carriage-return',
    ],
    [
      'a link of 2,049 characters',
      ['elements', 0, 'link'],
      `https://${'a'.repeat(2_041)}`,
      'elements[0].link',
      'too-long',
    ],
    [
      'a javascript: link',
      ['elements', 0, 'link'],
      'javascript:alert(1)',
      'elements[0].link',
      'unsafe-link',
    ],
    [
      'a data: link',
      ['elements', 6, 'link'],
      'data:text/html,x',
      'elements[6].link',
      'unsafe-link',
    ],
    [
      'an ftp: link',
      ['elements', 0, 'link'],
      'ftp://example.test',
      'elements[0].link',
      'unsafe-link',
    ],
    [
      'a link after a space',
      ['elements', 0, 'link'],
      ' https://example.test',
      'elements[0].link',
      'unsafe-link',
    ],
    ['a frame name that is a number', ['elements', 9, 'name'], 1, 'elements[9].name', 'not-string'],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });

  it.each<Acceptance>([
    ['a text of 100,000 characters', ['elements', 5, 'content'], block('a'.repeat(100_000))],
    ['a link of 2,048 characters', ['elements', 0, 'link'], `https://${'a'.repeat(2_040)}`],
    ['an upper-case scheme', ['elements', 0, 'link'], 'HTTPS://EXAMPLE.TEST'],
    ['an http: link', ['elements', 0, 'link'], 'http://example.test'],
  ])('accepts %s', (...row) => {
    expectAccepted(row);
  });
});

describe('closed sets of values', () => {
  it.each<Refusal>([
    ['an unknown kind', ['elements', 0, 'kind'], 'circle', 'elements[0].kind', 'unknown-value'],
    [
      'an unknown dash',
      ['elements', 0, 'style', 'stroke', 'dash'],
      'dash-dot',
      'elements[0].style.stroke.dash',
      'unknown-value',
    ],
    [
      'an unknown fill pattern',
      ['elements', 0, 'style', 'fill', 'pattern'],
      'dots',
      'elements[0].style.fill.pattern',
      'unknown-value',
    ],
    [
      'unknown corners',
      ['elements', 0, 'style', 'corners'],
      'bevel',
      'elements[0].style.corners',
      'unknown-value',
    ],
    [
      'an unknown alignment',
      ['elements', 5, 'content', 'align'],
      'justify',
      'elements[5].content.align',
      'unknown-value',
    ],
    [
      'an unknown font family',
      ['elements', 5, 'content', 'font', 'family'],
      'serif',
      'elements[5].content.font.family',
      'unknown-value',
    ],
    [
      'an unknown arrow head',
      ['elements', 6, 'heads', 'end'],
      'star',
      'elements[6].heads.end',
      'unknown-value',
    ],
    ['an unknown route', ['elements', 6, 'route'], 'zigzag', 'elements[6].route', 'unknown-value'],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });
});

describe('types and fields', () => {
  it.each<Refusal>([
    [
      'a locked flag as text',
      ['elements', 0, 'locked'],
      'false',
      'elements[0].locked',
      'not-boolean',
    ],
    ['a coordinate as text', ['elements', 0, 'x'], '1', 'elements[0].x', 'not-number'],
    ['a style that is an array', ['elements', 0, 'style'], [], 'elements[0].style', 'not-object'],
    ['points that are an object', ['elements', 3, 'points'], {}, 'elements[3].points', 'not-array'],
    ['an element that is a string', ['elements', 2], 'diamond', 'elements[2]', 'not-object'],
    [
      'an optional label set to null',
      ['elements', 0, 'label'],
      null,
      'elements[0].label',
      'not-object',
    ],
    [
      'a missing fill',
      ['elements', 0, 'style', 'fill'],
      undefined,
      'elements[0].style.fill',
      'missing',
    ],
    ['a missing kind', ['elements', 0, 'kind'], undefined, 'elements[0].kind', 'missing'],
    ['a missing identifier', ['elements', 0, 'id'], undefined, 'elements[0].id', 'missing'],
    ['a missing order key', ['elements', 0, 'order'], undefined, 'elements[0].order', 'missing'],
    [
      'a missing rotation',
      ['elements', 0, 'rotation'],
      undefined,
      'elements[0].rotation',
      'missing',
    ],
    ['a missing revision', ['elements', 0, 'rev'], undefined, 'elements[0].rev', 'missing'],
    [
      'a shape without a width',
      ['elements', 0, 'width'],
      undefined,
      'elements[0].width',
      'missing',
    ],
    [
      'a line without points',
      ['elements', 3, 'points'],
      undefined,
      'elements[3].points',
      'missing',
    ],
    [
      'a text without content',
      ['elements', 5, 'content'],
      undefined,
      'elements[5].content',
      'missing',
    ],
    ['an arrow without heads', ['elements', 6, 'heads'], undefined, 'elements[6].heads', 'missing'],
    ['a note without a label', ['elements', 7, 'label'], undefined, 'elements[7].label', 'missing'],
    ['an image without a file', ['elements', 8, 'file'], undefined, 'elements[8].file', 'missing'],
    ['a frame without a name', ['elements', 9, 'name'], undefined, 'elements[9].name', 'missing'],
    [
      'a canvas without a background',
      ['canvas', 'background'],
      undefined,
      'canvas.background',
      'missing',
    ],
    [
      'an unknown element field',
      ['elements', 0, 'selected'],
      true,
      'elements[0].selected',
      'unknown-field',
    ],
    ['a field of another kind', ['elements', 3, 'width'], 10, 'elements[3].width', 'unknown-field'],
    [
      'an unknown style field',
      ['elements', 0, 'style', 'theme'],
      'dark',
      'elements[0].style.theme',
      'unknown-field',
    ],
    ['an unknown canvas field', ['canvas', 'grid'], 20, 'canvas.grid', 'unknown-field'],
    ['an unknown group field', ['groups', 0, 'name'], 'g', 'groups[0].name', 'unknown-field'],
    ['a document revision', ['rev'], 3, 'rev', 'unknown-field'],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });

  it('refuses an own __proto__ field instead of reading it', () => {
    const text = JSON.stringify(fixtureJson()).replace(
      '"kind":"rectangle"',
      '"kind":"rectangle","__proto__":{"locked":true}',
    );
    expect(decodeDocument(text)).toStrictEqual({
      ok: false,
      errors: [{ path: 'elements[0].__proto__', problem: 'unknown-field' }],
    });
  });
});

describe('the number of elements', () => {
  const rectangle = (fixtureJson()['elements'] as JsonObject[])[2] ?? {};
  const withElements = (count: number, element: (index: number) => Json): string =>
    JSON.stringify({
      ...fixtureJson(),
      groups: [],
      elements: Array.from({ length: count }, (_, index) => element(index)),
    });

  it('REQ-P07 refuses 100,001 elements before reading any of them', () => {
    expect(decodeDocument(withElements(100_001, () => ({})))).toStrictEqual({
      ok: false,
      errors: [{ path: 'elements', problem: 'too-many' }],
    });
  });

  it('accepts 100,000 elements', { timeout: 60_000 }, () => {
    const id = (index: number) => `R${String(index).padStart(21, '0')}`;
    const decoded = decodeDocument(
      withElements(100_000, (index) => ({ ...rectangle, id: id(index) })),
    );
    expect(decoded.ok && decoded.value.elements.size).toBe(100_000);
  });
});
