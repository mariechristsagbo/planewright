// Viewport capture for the external interaction driver.
//
// Captures go through the driver's own CDP session. Playwright's page.screenshot() was found to
// reset emulated metrics (mobile DPR to 1, screen to 800x600) until the next navigation, so it is
// not used. Masks are painted onto the decoded image in this process: the unmasked bytes never
// reach disk and the page DOM is not touched. Mask boxes (CSS px) and the image/CSS scale are
// returned for offline checks with check-masks.mjs.
//
// Nothing is written when
//   - a `refuseIf` selector matches,
//   - any requested mask yields no usable box (it matched nothing, or only hidden, empty or
//     wholly off-screen elements),
//   - the live URL fragment holds a room or `json` link value and no mask produced a box, or an
//     on-screen element that may show the value (see SECRET_SURFACES) lies outside every mask box,
//   - the URL gains such a value while the capture runs,
//   - the file name is already used.
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { writeExclusive } from './files.mjs';
import { outputPath } from './guard.mjs';
import { decodePng, encodePng, paintBoxes } from './png.mjs';
import { LINK_KEY_TEXT, hasSecretFragment } from './sanitise.mjs';

const readView = () => ({
  href: location.href,
  cssWidth: window.innerWidth,
  cssHeight: window.innerHeight,
});

/**
 * A box is usable when its position is finite, its size is positive and finite, and part of it
 * lies inside the viewport (CSS px). An off-screen box would paint nothing on the capture, so it
 * cannot count as a mask.
 */
export function isUsableBox(box, view) {
  return hasFiniteSize(box) && overlapsView(box, view);
}

function hasFiniteSize(box) {
  if (box === null || typeof box !== 'object') return false;
  const values = [box.x, box.y, box.width, box.height];
  return values.every(Number.isFinite) && box.width > 0 && box.height > 0;
}

function overlapsView(box, view) {
  const inside = box.x < view?.cssWidth && box.y < view?.cssHeight;
  return inside && box.x + box.width > 0 && box.y + box.height > 0;
}

async function usableBoxes(locator, view) {
  const matches = await locator.all();
  const boxes = [];
  for (const match of matches) {
    const box = await match.boundingBox();
    if (isUsableBox(box, view)) boxes.push(box);
  }
  return { matched: matches.length, boxes };
}

// Every requested mask must contribute at least one on-screen box, or the capture is refused.
async function maskBoxesFor(page, selectors, view) {
  if (!Array.isArray(selectors)) throw new Error('mask must be an array of selectors.');
  const all = [];
  for (const [index, selector] of selectors.entries()) {
    const { matched, boxes } = await usableBoxes(page.locator(selector), view);
    if (boxes.length === 0) {
      const why = matched === 0 ? 'matched nothing' : 'has no usable box';
      throw new Error(`Screenshot refused: mask ${String(index)} ${why}.`);
    }
    all.push(...boxes);
  }
  return all;
}

// Elements that may show a room value while the URL holds one: link fields and QR code images or
// canvases in a dialog, and any element whose text names a room or link key. Other renderings
// (an SVG code, a value split across elements, a shadow root) are not detected here.
export const SECRET_SURFACES = [
  '[role=dialog] input',
  '[role=dialog] textarea',
  '[role=dialog] img',
  '[role=dialog] canvas',
];
const TOLERANCE = 1;

// The part of a box inside the viewport, as edges.
const clip = (box, view) => ({
  left: Math.max(box.x, 0),
  top: Math.max(box.y, 0),
  right: Math.min(box.x + box.width, view.cssWidth),
  bottom: Math.min(box.y + box.height, view.cssHeight),
});

/** True when the on-screen part of a box lies inside one mask box (CSS px, 1 px tolerance). */
export function isCovered(box, masks, view) {
  const inner = clip(box, view);
  return masks.some((mask) => {
    const outer = clip(mask, view);
    const fitsX = outer.left <= inner.left + TOLERANCE && outer.right >= inner.right - TOLERANCE;
    return fitsX && outer.top <= inner.top + TOLERANCE && outer.bottom >= inner.bottom - TOLERANCE;
  });
}

async function surfaceBoxes(page, view) {
  const locators = [...SECRET_SURFACES.map((s) => page.locator(s)), page.getByText(LINK_KEY_TEXT)];
  const boxes = [];
  for (const locator of locators) boxes.push(...(await usableBoxes(locator, view)).boxes);
  return boxes;
}

// A room or link value in the URL may be on screen (share dialog, link fields, QR code), so a
// capture then needs masks, and they must cover every element that may show the value.
async function refuseSecretView(page, view, masks) {
  if (masks.length === 0) {
    throw new Error('Screenshot refused: the URL fragment holds a collaboration value.');
  }
  const open = (await surfaceBoxes(page, view)).filter((box) => !isCovered(box, masks, view));
  if (open.length > 0) {
    const count = String(open.length);
    throw new Error(
      `Screenshot refused: ${count} element(s) that may show the collaboration value are not masked.`,
    );
  }
}

async function refuseIfPresent(page, selectors) {
  for (const selector of selectors) {
    if ((await page.locator(selector).count()) > 0) {
      throw new Error('Screenshot refused: a refuseIf selector is present.');
    }
  }
}

export async function screenshot(ctx, step) {
  const file = outputPath(ctx.outDir, 'screenshots', step.name, '.png');
  await refuseIfPresent(ctx.page, step.refuseIf ?? []);
  const view = await ctx.page.evaluate(readView);
  const boxes = await maskBoxesFor(ctx.page, step.mask ?? [], view);
  const secret = hasSecretFragment(view.href);
  if (secret) await refuseSecretView(ctx.page, view, boxes);
  const { data } = await ctx.cdp.send('Page.captureScreenshot', { format: 'png' });
  // The fragment can change while the capture runs, so it is read again before writing. A view
  // that gained a value was never checked against its masks, so it is refused.
  if (!secret && hasSecretFragment((await ctx.page.evaluate(readView)).href)) {
    throw new Error('Screenshot refused: the URL gained a collaboration value during the capture.');
  }
  let bytes = Buffer.from(data, 'base64');
  const scale = bytes.readUInt32BE(16) / view.cssWidth;
  if (boxes.length > 0) bytes = encodePng(paintBoxes(decodePng(bytes), boxes, scale));
  writeExclusive(file, bytes);
  return {
    file: basename(file),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    masks: (step.mask ?? []).length,
    maskBoxes: boxes,
    scale,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}
