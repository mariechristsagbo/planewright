import { describe, expect, it } from 'vitest';

import { TAU } from '../../../src/math/angle.ts';
import { decodeDocument } from '../../../src/model/decode.ts';
import { fixtureJson } from '../../support/fixtures.ts';
import { expectAccepted, expectRefused } from '../../support/refusals.ts';
import type { Acceptance, Refusal } from '../../support/refusals.ts';

// Each limit and invariant of the domain model, broken once in the valid fixture: the decoder must
// return exactly one error with the path of the broken value, and no document at all (REQ-P07).
// Fixture elements: 0 rectangle, 1 ellipse, 2 diamond, 3 line, 4 freehand, 5 text, 6 arrow,
// 7 note, 8 image, 9 frame.

describe('numbers', () => {
  it.each<Refusal>([
    ['x above 1e9', ['elements', 0, 'x'], 1e9 + 1, 'elements[0].x', 'out-of-range'],
    ['x below -1e9', ['elements', 0, 'x'], -1e9 - 1, 'elements[0].x', 'out-of-range'],
    ['y above 1e9', ['elements', 6, 'y'], 1.5e9, 'elements[6].y', 'out-of-range'],
    ['a width above 1e7', ['elements', 0, 'width'], 1e7 + 1, 'elements[0].width', 'out-of-range'],
    ['a negative height', ['elements', 9, 'height'], -1, 'elements[9].height', 'out-of-range'],
    ['a rotation of 2π', ['elements', 0, 'rotation'], TAU, 'elements[0].rotation', 'out-of-range'],
    [
      'a negative rotation',
      ['elements', 6, 'rotation'],
      -0.1,
      'elements[6].rotation',
      'out-of-range',
    ],
    [
      'an opacity above 1',
      ['elements', 0, 'style', 'opacity'],
      1.5,
      'elements[0].style.opacity',
      'out-of-range',
    ],
    [
      'a negative opacity',
      ['elements', 3, 'style', 'opacity'],
      -0.1,
      'elements[3].style.opacity',
      'out-of-range',
    ],
    [
      'a stroke width of 0',
      ['elements', 0, 'style', 'stroke', 'width'],
      0,
      'elements[0].style.stroke.width',
      'out-of-range',
    ],
    [
      'a stroke width above 100',
      ['elements', 0, 'style', 'stroke', 'width'],
      100.5,
      'elements[0].style.stroke.width',
      'out-of-range',
    ],
    [
      'a font size below 1',
      ['elements', 5, 'content', 'font', 'size'],
      0.5,
      'elements[5].content.font.size',
      'out-of-range',
    ],
    [
      'a font size above 1000',
      ['elements', 0, 'label', 'font', 'size'],
      1001,
      'elements[0].label.font.size',
      'out-of-range',
    ],
    [
      'a line height below 1',
      ['elements', 7, 'label', 'font', 'lineHeight'],
      0.99,
      'elements[7].label.font.lineHeight',
      'out-of-range',
    ],
    [
      'a line height above 3',
      ['elements', 6, 'label', 'font', 'lineHeight'],
      3.01,
      'elements[6].label.font.lineHeight',
      'out-of-range',
    ],
    [
      'an anchor beyond the box',
      ['elements', 6, 'start', 'anchor', 'x'],
      1.1,
      'elements[6].start.anchor.x',
      'out-of-range',
    ],
    [
      'an anchor before the box',
      ['elements', 6, 'end', 'anchor', 'y'],
      -0.1,
      'elements[6].end.anchor.y',
      'out-of-range',
    ],
    [
      'a pressure above 1',
      ['elements', 4, 'pressures', 1],
      1.5,
      'elements[4].pressures[1]',
      'out-of-range',
    ],
    [
      'a negative crop width',
      ['elements', 8, 'crop', 'width'],
      -1,
      'elements[8].crop.width',
      'out-of-range',
    ],
    [
      'a crop x beyond 1e9',
      ['elements', 8, 'crop', 'x'],
      2e9,
      'elements[8].crop.x',
      'out-of-range',
    ],
    [
      'a point beyond the size limit',
      ['elements', 3, 'points', 1, 'x'],
      2e7,
      'elements[3].points[1].x',
      'out-of-range',
    ],
    ['a negative revision', ['elements', 0, 'rev'], -1, 'elements[0].rev', 'out-of-range'],
    ['a fractional revision', ['elements', 0, 'rev'], 1.5, 'elements[0].rev', 'not-integer'],
    [
      'a sketch level of 3',
      ['elements', 0, 'style', 'sketch'],
      3,
      'elements[0].style.sketch',
      'unknown-value',
    ],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });

  it.each([
    ['x', '"x":0,', '"x":1e999,'],
    ['y', '"y":0,', '"y":-1e999,'],
  ])('refuses a %s that JSON reads as infinite', (field, from, to) => {
    const text = JSON.stringify(fixtureJson()).replace(from, to);
    expect(decodeDocument(text)).toStrictEqual({
      ok: false,
      errors: [{ path: `elements[0].${field}`, problem: 'not-finite' }],
    });
  });

  it.each<Acceptance>([
    ['x at 1e9', ['elements', 0, 'x'], 1e9],
    ['y at -1e9', ['elements', 0, 'y'], -1e9],
    ['a width of 1e7', ['elements', 0, 'width'], 1e7],
    ['a rotation just below 2π', ['elements', 0, 'rotation'], TAU - 2 ** -50],
    ['a stroke width of 100', ['elements', 0, 'style', 'stroke', 'width'], 100],
    ['the smallest stroke width', ['elements', 0, 'style', 'stroke', 'width'], Number.MIN_VALUE],
    ['an opacity of 0', ['elements', 0, 'style', 'opacity'], 0],
    ['a font size of 1000', ['elements', 5, 'content', 'font', 'size'], 1000],
    ['a line height of 3', ['elements', 5, 'content', 'font', 'lineHeight'], 3],
  ])('accepts %s', (...row) => {
    expectAccepted(row);
  });
});
