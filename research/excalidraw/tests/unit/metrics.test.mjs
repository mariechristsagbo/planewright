import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertMetrics,
  expectedFromEmulation,
  metricMismatches,
  readMetrics,
} from '../../lib/metrics.mjs';

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
  orientationType: 'portrait-primary',
  orientationAngle: 0,
  canvases: [
    { cls: 'static', width: 1170, height: 2532, clientWidth: 390, clientHeight: 844 },
    { cls: 'interactive', width: 1170, height: 2532, clientWidth: 390, clientHeight: 844 },
  ],
};

// A page as readMetrics sees it: the globals it reads, with an optional screen orientation.
function stubPage(orientation) {
  vi.stubGlobal('window', {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    screen: { width: 390, height: 844, ...(orientation ? { orientation } : {}) },
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' }),
  });
  vi.stubGlobal('navigator', { maxTouchPoints: 5 });
  vi.stubGlobal('document', { querySelectorAll: () => [] });
}

describe('readMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the screen orientation type and angle', () => {
    stubPage({ type: 'portrait-primary', angle: 0 });
    expect(readMetrics()).toMatchObject({
      screenWidth: 390,
      coarsePointer: true,
      orientationType: 'portrait-primary',
      orientationAngle: 0,
    });
  });

  it('reads null for both when the page has no screen orientation', () => {
    stubPage(undefined);
    expect(readMetrics()).toMatchObject({ orientationType: null, orientationAngle: null });
  });
});

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

  it('expects the screen orientation that the step asks for, in the form the page reports', () => {
    const step = { ...mobileStep, screenOrientation: { type: 'portraitPrimary', angle: 0 } };
    expect(expectedFromEmulation(step)).toMatchObject({
      orientationType: 'portrait-primary',
      orientationAngle: 0,
    });
    const landscape = {
      ...mobileStep,
      screenOrientation: { type: 'landscapeSecondary', angle: 270 },
    };
    expect(expectedFromEmulation(landscape)).toMatchObject({
      orientationType: 'landscape-secondary',
      orientationAngle: 270,
    });
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

  it('reports a landscape or rotated screen, and a page without an orientation', () => {
    const expected = { orientationType: 'portrait-primary', orientationAngle: 0 };
    expect(metricMismatches(expected, loadedMobile)).toEqual([]);
    expect(
      metricMismatches(expected, {
        ...loadedMobile,
        orientationType: 'landscape-primary',
        orientationAngle: 90,
      }),
    ).toEqual([
      'orientationType: expected portrait-primary, read landscape-primary',
      'orientationAngle: expected 0, read 90',
    ]);
    expect(
      metricMismatches(expected, {
        ...loadedMobile,
        orientationType: null,
        orientationAngle: null,
      }),
    ).toEqual([
      'orientationType: expected portrait-primary, read null',
      'orientationAngle: expected 0, read null',
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
