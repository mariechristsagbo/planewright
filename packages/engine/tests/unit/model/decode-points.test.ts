import { describe, it } from 'vitest';

import { fixtureJson } from '../../support/fixtures.ts';
import type { Json, JsonObject } from '../../support/fixtures.ts';
import { expectAccepted, expectRefused } from '../../support/refusals.ts';
import type { Acceptance, Refusal } from '../../support/refusals.ts';

// Each limit and invariant of the domain model, broken once in the valid fixture: the decoder must
// return exactly one error with the path of the broken value, and no document at all (REQ-P07).
// Fixture elements: 0 rectangle, 1 ellipse, 2 diamond, 3 line, 4 freehand, 5 text, 6 arrow,
// 7 note, 8 image, 9 frame.

const zeros = (count: number) => Array.from({ length: count }, () => ({ x: 0, y: 0 }));

/** The fixture's freehand stroke with other points and no pressures. */
function freehand(points: Json): JsonObject {
  const element = { ...(fixtureJson()['elements'] as JsonObject[])[4], points };
  Reflect.deleteProperty(element, 'pressures');
  return element;
}

describe('points', () => {
  it.each<Refusal>([
    ['a line of 1 point', ['elements', 3, 'points'], zeros(1), 'elements[3].points', 'too-few'],
    ['an arrow of 1 point', ['elements', 6, 'points'], zeros(1), 'elements[6].points', 'too-few'],
    [
      'a freehand stroke of no point',
      ['elements', 4, 'points'],
      [],
      'elements[4].points',
      'too-few',
    ],
    [
      'a line of 10,001 points',
      ['elements', 3, 'points'],
      zeros(10_001),
      'elements[3].points',
      'too-many',
    ],
    [
      'an arrow of 10,001 points',
      ['elements', 6, 'points'],
      zeros(10_001),
      'elements[6].points',
      'too-many',
    ],
    [
      'a freehand stroke of 50,001 points',
      ['elements', 4, 'points'],
      zeros(50_001),
      'elements[4].points',
      'too-many',
    ],
    [
      'points 2e-9 from 0',
      ['elements', 3, 'points'],
      [
        { x: 2e-9, y: 0 },
        { x: 5, y: 3 },
      ],
      'elements[3].points',
      'not-normalised',
    ],
    [
      'points 2e-9 below 0',
      ['elements', 6, 'points'],
      [
        { x: 0, y: -2e-9 },
        { x: 5, y: 3 },
      ],
      'elements[6].points',
      'not-normalised',
    ],
    [
      'points wider than 1e7',
      ['elements', 3, 'points'],
      [
        { x: -1e-9, y: 0 },
        { x: 1e7, y: 0 },
      ],
      'elements[3].points',
      'out-of-range',
    ],
    [
      'a pressure missing',
      ['elements', 4, 'pressures'],
      [0.5, 1],
      'elements[4].pressures',
      'length-mismatch',
    ],
    [
      'a pressure too many',
      ['elements', 4, 'pressures'],
      [0.5, 1, 0, 1],
      'elements[4].pressures',
      'length-mismatch',
    ],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });

  it.each<Acceptance>([
    ['a line of 10,000 points', ['elements', 3, 'points'], zeros(10_000)],
    ['a freehand stroke of 50,000 points', ['elements', 4], freehand(zeros(50_000))],
    ['a dot, a freehand stroke of one point', ['elements', 4], freehand(zeros(1))],
    [
      'points within 1e-9 of 0',
      ['elements', 3, 'points'],
      [
        { x: 1e-9, y: -1e-9 },
        { x: 5, y: 3 },
      ],
    ],
  ])('accepts %s', (...row) => {
    expectAccepted(row);
  });
});
