import { describe, expect, it } from 'vitest';

import { screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { FIT_PADDING, zoomToFit } from '../../../src/camera/fit.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';
import type { Box } from '../../../src/model/elements.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });
const VIEWPORT: ViewportSize = { width: 1280, height: 720, pixelRatio: 1 };
const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });

/** The content's box on screen after the fit. */
function onScreen(content: Box, after: Camera): Box {
  const topLeft = screenFromScene({ x: content.x, y: content.y }, after);
  const bottomRight = screenFromScene(
    { x: content.x + content.width, y: content.y + content.height },
    after,
  );
  return box(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
}

describe('zoomToFit', () => {
  it('pads the content by 32 screen pixels', () => {
    expect(FIT_PADDING).toBe(32);
  });

  it('REQ-V09 centres the content on both axes without zooming above 100 %', () => {
    const content = box(100, 1000, 200, 100);
    const after = zoomToFit(camera(5, 5, 3), content, VIEWPORT);
    expect(after).toStrictEqual(camera(-440, 690, 1));
    expect(onScreen(content, after)).toStrictEqual(box(540, 310, 200, 100));
  });

  it('REQ-V09 zooms out until the wider side fits inside the padding, and centres it', () => {
    const wide = box(0, 0, 2432, 328);
    const after = zoomToFit(camera(0, 0, 1), wide, VIEWPORT);
    expect(after).toStrictEqual(camera(-64, -556, 0.5));
    expect(onScreen(wide, after)).toStrictEqual(box(32, 278, 1216, 164));
    const tall = box(-50, -50, 100, 1312);
    expect(zoomToFit(camera(0, 0, 1), tall, VIEWPORT).zoom).toBe(0.5);
  });

  it('REQ-V09 gives the same camera whatever the camera was before', () => {
    const content = box(-300, 40, 5000, 900);
    const expected = zoomToFit(camera(0, 0, 1), content, VIEWPORT);
    expect(zoomToFit(camera(-7e8, 3e5, 0.1), content, VIEWPORT)).toStrictEqual(expected);
    expect(zoomToFit(camera(12, -9, 30), content, VIEWPORT)).toStrictEqual(expected);
  });

  it('REQ-V08 zooms out no further than 0.1, even when the content cannot fit', () => {
    expect(zoomToFit(camera(0, 0, 1), box(0, 0, 1e6, 10), VIEWPORT).zoom).toBe(0.1);
    const narrow: ViewportSize = { width: 50, height: 720, pixelRatio: 1 };
    expect(zoomToFit(camera(0, 0, 1), box(0, 0, 10, 10), narrow).zoom).toBe(0.1);
  });

  it('lets a side without extent leave the zoom to the other side', () => {
    expect(zoomToFit(camera(0, 0, 1), box(5, 0, 0, 6560), VIEWPORT)).toStrictEqual(
      camera(5 - 6400, 3280 - 3600, 0.1),
    );
    expect(zoomToFit(camera(0, 0, 2), box(7, 9, 0, 0), VIEWPORT)).toStrictEqual(
      camera(7 - 640, 9 - 360, 1),
    );
    const flat: ViewportSize = { width: 64, height: 64, pixelRatio: 1 };
    expect(zoomToFit(camera(0, 0, 2), box(7, 9, 0, 0), flat)).toStrictEqual(camera(-25, -23, 1));
  });

  it('REQ-V09 leaves the camera where it is when there is no content', () => {
    const start = Object.freeze(camera(3, 4, 2.5));
    const after = zoomToFit(start, null, VIEWPORT);
    expect(after).toStrictEqual(camera(3, 4, 2.5));
    expect(after).not.toBe(start);
  });

  it('REQ-V08 ignores content that is not a number', () => {
    expect(zoomToFit(camera(3, 4, 2), box(Number.NaN, 0, 10, 10), VIEWPORT)).toStrictEqual(
      camera(3, 4, 2),
    );
  });
});
