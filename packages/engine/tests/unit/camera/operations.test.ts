import { describe, expect, it } from 'vitest';

import { POSITION_LIMIT } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { zoomToFit } from '../../../src/camera/fit.ts';
import { resetZoom, zoomIn, zoomOut } from '../../../src/camera/ladder.ts';
import { panBy, wheelPan } from '../../../src/camera/pan.ts';
import { twoPointerCamera } from '../../../src/camera/pinch.ts';
import { resizeViewport } from '../../../src/camera/viewport.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';
import { wheelZoom, zoomAbout } from '../../../src/camera/zoom.ts';
import { contentBounds } from '../../../src/geometry/world-bounds.ts';
import { randomBetween, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { encodeDocument } from '../../../src/model/encode.ts';
import { anyCamera } from '../../support/cameras.ts';
import { fixtureDocument } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';
import { chance, pick } from '../../support/scenes.ts';

/** Freezes a value and everything in it, so that any write to it throws in this strict module. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const VIEWPORT: ViewportSize = deepFreeze({ width: 1280, height: 720, pixelRatio: 2 });
const SMALLER: ViewportSize = deepFreeze({ width: 640, height: 480, pixelRatio: 1 });
const at = (x: number, y: number) => deepFreeze({ x, y });

/** Every camera operation, each given frozen arguments. */
const OPERATIONS: readonly (readonly [string, (camera: Camera) => Camera])[] = [
  ['panBy', (c) => panBy(c, at(30, -40))],
  ['wheelPan', (c) => wheelPan(c, at(0, 120), false)],
  ['zoomAbout', (c) => zoomAbout(c, at(200, 100), 4)],
  ['wheelZoom', (c) => wheelZoom(c, at(200, 100), -100)],
  ['zoomIn', (c) => zoomIn(c, VIEWPORT)],
  ['zoomOut', (c) => zoomOut(c, VIEWPORT)],
  ['resetZoom', (c) => resetZoom(c, VIEWPORT)],
  ['zoomToFit', (c) => zoomToFit(c, deepFreeze({ x: 0, y: 0, width: 500, height: 300 }), VIEWPORT)],
  ['zoomToFit without content', (c) => zoomToFit(c, null, VIEWPORT)],
  ['twoPointerCamera', (c) => twoPointerCamera(c, [at(0, 0), at(100, 0)], [at(0, 0), at(150, 0)])],
  ['resizeViewport', (c) => resizeViewport(c, VIEWPORT, SMALLER)],
];

describe('every camera operation', () => {
  it.each(OPERATIONS)(
    '%s returns a new camera and leaves the one it was given as it was',
    (_, operate) => {
      const start = deepFreeze({ x: 12.5, y: -7, zoom: 1 });
      const after = operate(start);
      expect(after).not.toBe(start);
      expect(Object.keys(after).sort()).toStrictEqual(['x', 'y', 'zoom']);
      expect(start).toStrictEqual({ x: 12.5, y: -7, zoom: 1 });
    },
  );

  it('never touches the document: fitting its content reads it and leaves it as it was', () => {
    const document = fixtureDocument();
    for (const element of document.elements.values()) deepFreeze(element);
    const encoded = encodeDocument(document);
    const elements = [...document.elements.values()];
    const after = zoomToFit(
      { x: 0, y: 0, zoom: 1 },
      contentBounds(document.elements.values()),
      VIEWPORT,
    );
    expect(after.zoom).toBeLessThan(1);
    expect(encodeDocument(document)).toBe(encoded);
    expect([...document.elements.values()]).toStrictEqual(elements);
    expect(document.rev).toBe(0);
  });
});

// The REQ-V08 property: a random session of camera operations whose inputs are sometimes huge,
// infinite or not a number never leaves the limits.

const EXTREMES = [Number.NaN, Infinity, -Infinity, 1e12, -1e12, 0, 1e-12, -1e-300];

type Numbers = readonly [number, number, number, number, number, number, number, number];

interface Step {
  readonly name: string;
  readonly numbers: Numbers;
  readonly flag: boolean;
}

const anyNumber = (random: Random): number =>
  chance(random, 0.25) ? pick(random, EXTREMES) : randomBetween(random, -5000, 5000);

const anyNumbers = (random: Random): Numbers => [
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
  anyNumber(random),
];

const size = (width: number, height: number): ViewportSize => ({ width, height, pixelRatio: 1 });

const STEPS: Readonly<Record<string, (c: Camera, n: Numbers, flag: boolean) => Camera>> = {
  panBy: (c, [x, y]) => panBy(c, { x, y }),
  wheelPan: (c, [x, y], flag) => wheelPan(c, { x, y }, flag),
  zoomAbout: (c, [x, y, zoom]) => zoomAbout(c, { x, y }, zoom),
  wheelZoom: (c, [x, y, deltaY]) => wheelZoom(c, { x, y }, deltaY),
  zoomIn: (c, [width, height]) => zoomIn(c, size(width, height)),
  zoomOut: (c, [width, height]) => zoomOut(c, size(width, height)),
  resetZoom: (c, [width, height]) => resetZoom(c, size(width, height)),
  zoomToFit: (c, [x, y, w, h, width, height], flag) =>
    zoomToFit(c, flag ? null : { x, y, width: w, height: h }, size(width, height)),
  twoPointerCamera: (c, [a, b, d, e, f, g, h, i]) =>
    twoPointerCamera(
      c,
      [
        { x: a, y: b },
        { x: d, y: e },
      ],
      [
        { x: f, y: g },
        { x: h, y: i },
      ],
    ),
  resizeViewport: (c, [a, b, d, e]) => resizeViewport(c, size(a, b), size(d, e)),
};

const anyStep = (random: Random): Step => ({
  name: pick(random, Object.keys(STEPS)),
  numbers: anyNumbers(random),
  flag: chance(random, 0.3),
});

describe('the camera limits over random sessions', () => {
  it('REQ-V08 keep the zoom within [0.1, 30] and the position within 10⁹ for every input', () => {
    let operations = 0;
    checkProperty(
      { seed: 5107, runs: 200 },
      (random) => ({
        start: anyCamera(random, POSITION_LIMIT),
        steps: Array.from({ length: randomInt(random, 1, 25) }, () => anyStep(random)),
      }),
      ({ start, steps }) => {
        let current = start;
        for (const { name, numbers, flag } of steps) {
          const step = STEPS[name];
          if (step === undefined) throw new Error(`No step named ${name}.`);
          current = step(current, numbers, flag);
          operations += 1;
          expect([current.x, current.y, current.zoom].every(Number.isFinite)).toBe(true);
          expect(current.zoom).toBeGreaterThanOrEqual(0.1);
          expect(current.zoom).toBeLessThanOrEqual(30);
          expect(Math.abs(current.x)).toBeLessThanOrEqual(1e9);
          expect(Math.abs(current.y)).toBeLessThanOrEqual(1e9);
        }
      },
    );
    expect(operations).toBeGreaterThan(2000);
  });
});
