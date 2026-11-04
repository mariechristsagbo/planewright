// Viewport metrics read back from the page after emulation, and the comparison that makes a
// run fail fast when the page does not report the requested CSS viewport, DPR, screen size,
// touch support or canvas backing store.

/** Runs in the page. Reads only layout metrics and canvas sizes. */
export function readMetrics() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    canvases: [...document.querySelectorAll('canvas')].map((c) => ({
      cls: c.className,
      width: c.width,
      height: c.height,
      clientWidth: c.clientWidth,
      clientHeight: c.clientHeight,
    })),
  };
}

/** The expectation implied by an emulate step, plus any explicit `expect` overrides. */
export function expectedFromEmulation(step) {
  const touch = step.hasTouch === true;
  const base = {
    devicePixelRatio: step.deviceScaleFactor ?? 1,
    screenWidth: step.width,
    screenHeight: step.height,
    maxTouchPoints: touch ? 5 : 0,
  };
  // A mobile layout viewport only matches the device width once a page with a viewport meta tag
  // has loaded, so CSS viewport checks for mobile emulation belong to `assertMetrics` after load.
  if (step.mobile !== true)
    Object.assign(base, { innerWidth: step.width, innerHeight: step.height });
  return { ...base, ...step.expect };
}

const SCALARS = [
  'innerWidth',
  'innerHeight',
  'devicePixelRatio',
  'screenWidth',
  'screenHeight',
  'maxTouchPoints',
  'coarsePointer',
];

function canvasMismatches(expected, actual) {
  if (expected.canvasBacking !== true) return [];
  if (actual.canvases.length === 0) return ['canvasBacking: no canvas on the page'];
  const dpr = actual.devicePixelRatio;
  return actual.canvases
    .filter(
      (c) =>
        c.width !== Math.round(c.clientWidth * dpr) ||
        c.height !== Math.round(c.clientHeight * dpr),
    )
    .map((c) => `canvasBacking: ${c.cls || 'canvas'} ${c.width}x${c.height} at DPR ${dpr}`);
}

/** Lists every expected metric the page did not report. An empty list means the run may go on. */
export function metricMismatches(expected, actual) {
  const scalar = SCALARS.filter((key) => key in expected && expected[key] !== actual[key]).map(
    (key) => `${key}: expected ${String(expected[key])}, read ${String(actual[key])}`,
  );
  return [...scalar, ...canvasMismatches(expected, actual)];
}

/** An error that stops the batch even when continueOnError is set. */
export class FatalStepError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FatalStepError';
    this.fatal = true;
  }
}

export function assertMetrics(expected, actual) {
  const mismatches = metricMismatches(expected, actual);
  if (mismatches.length > 0) {
    throw new FatalStepError(`Metrics mismatch, run aborted: ${mismatches.join('; ')}`);
  }
  return actual;
}
