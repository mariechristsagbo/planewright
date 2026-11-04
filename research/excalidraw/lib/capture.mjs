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
//   - any requested mask yields no usable box (it matched nothing, or only hidden or empty
//     elements),
//   - the live URL fragment holds a room or `json` link value, before or after the capture, and
//     no mask produced a box,
//   - the file name is already used.
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { writeExclusive } from './files.mjs';
import { outputPath } from './guard.mjs';
import { decodePng, encodePng, paintBoxes } from './png.mjs';
import { hasSecretFragment } from './sanitise.mjs';

const readView = () => ({ href: location.href, cssWidth: window.innerWidth });

/** A box is usable when its position is finite and its size is positive and finite. */
export function isUsableBox(box) {
  if (box === null || typeof box !== 'object') return false;
  const values = [box.x, box.y, box.width, box.height];
  return values.every(Number.isFinite) && box.width > 0 && box.height > 0;
}

async function usableBoxes(page, selector) {
  const matches = await page.locator(selector).all();
  const boxes = [];
  for (const match of matches) {
    const box = await match.boundingBox();
    if (isUsableBox(box)) boxes.push(box);
  }
  return { matched: matches.length, boxes };
}

// Every requested mask must contribute at least one usable box, or the capture is refused.
async function maskBoxesFor(page, selectors) {
  if (!Array.isArray(selectors)) throw new Error('mask must be an array of selectors.');
  const all = [];
  for (const [index, selector] of selectors.entries()) {
    const { matched, boxes } = await usableBoxes(page, selector);
    if (boxes.length === 0) {
      const why = matched === 0 ? 'matched nothing' : 'has no usable box';
      throw new Error(`Screenshot refused: mask ${String(index)} ${why}.`);
    }
    all.push(...boxes);
  }
  return all;
}

// A room or link value in the URL may be on screen (share dialog, link fields, QR code), so a
// capture then needs explicit masks that produced boxes.
function refuseSecretView(href, boxes) {
  if (hasSecretFragment(href) && boxes.length === 0) {
    throw new Error('Screenshot refused: the URL fragment holds a collaboration value.');
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
  const boxes = await maskBoxesFor(ctx.page, step.mask ?? []);
  const view = await ctx.page.evaluate(readView);
  refuseSecretView(view.href, boxes);
  const { data } = await ctx.cdp.send('Page.captureScreenshot', { format: 'png' });
  // The fragment can change while the capture runs, so it is read again before writing.
  refuseSecretView((await ctx.page.evaluate(readView)).href, boxes);
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
