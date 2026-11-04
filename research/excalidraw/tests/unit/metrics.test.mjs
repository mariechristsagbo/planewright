import { describe, expect, it } from 'vitest';

import { assertMetrics, expectedFromEmulation, metricMismatches } from '../../lib/metrics.mjs';

const mobileStep = {
  do: 'emulate',
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
  hasTouch: true,
};

const loadedMobile = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  screenWidth: 390,
  screenHeight: 844,
  maxTouchPoints: 5,
  coarsePointer: true,
  canvases: [
    { cls: 'static', width: 1170, height: 2532, clientWidth: 390, clientHeight: 844 },
    { cls: 'interactive', width: 1170, height: 2532, clientWidth: 390, clientHeight: 844 },
  ],
};

describe('expectedFromEmulation', () => {
  it('expects DPR, screen and touch for mobile, and leaves the layout viewport to later checks', () => {
    expect(expectedFromEmulation(mobileStep)).toEqual({
      devicePixelRatio: 3,
      screenWidth: 390,
      screenHeight: 844,
      maxTouchPoints: 5,
    });
  });

  it('expects the CSS viewport for desktop emulation and accepts overrides', () => {
    expect(expectedFromEmulation({ width: 1280, height: 720 })).toEqual({
      devicePixelRatio: 1,
      screenWidth: 1280,
      screenHeight: 720,
      maxTouchPoints: 0,
      innerWidth: 1280,
      innerHeight: 720,
    });
    expect(expectedFromEmulation({ ...mobileStep, expect: { innerWidth: 390 } }).innerWidth).toBe(
      390,
    );
  });
});

describe('metricMismatches', () => {
  it('passes a loaded mobile page at DPR 3 with matching canvas backing', () => {
    const expected = { ...expectedFromEmulation(mobileStep), innerWidth: 390, canvasBacking: true };
    expect(metricMismatches(expected, loadedMobile)).toEqual([]);
  });

  it('reports the recorded scenario 10 failure: DPR reads 1 while the canvas stays 1170x2532', () => {
    const actual = { ...loadedMobile, devicePixelRatio: 1 };
    const found = metricMismatches({ devicePixelRatio: 3, canvasBacking: true }, actual);
    expect(found[0]).toBe('devicePixelRatio: expected 3, read 1');
    expect(found.filter((m) => m.startsWith('canvasBacking'))).toHaveLength(2);
  });

  it('reports wrong viewport, screen and touch values, and a missing canvas', () => {
    const found = metricMismatches(
      {
        innerWidth: 390,
        screenWidth: 390,
        maxTouchPoints: 5,
        coarsePointer: true,
        canvasBacking: true,
      },
      { ...loadedMobile, innerWidth: 980, screenWidth: 1280, maxTouchPoints: 0, canvases: [] },
    );
    expect(found).toEqual([
      'innerWidth: expected 390, read 980',
      'screenWidth: expected 390, read 1280',
      'maxTouchPoints: expected 5, read 0',
      'canvasBacking: no canvas on the page',
    ]);
  });
});

describe('assertMetrics', () => {
  it('returns the metrics when they match', () => {
    expect(assertMetrics({ devicePixelRatio: 3 }, loadedMobile)).toBe(loadedMobile);
  });

  it('throws a fatal error that names every mismatch', () => {
    let caught;
    try {
      assertMetrics({ devicePixelRatio: 3 }, { ...loadedMobile, devicePixelRatio: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught?.fatal).toBe(true);
    expect(caught?.message).toMatch(/run aborted: devicePixelRatio: expected 3, read 1/u);
  });
});
