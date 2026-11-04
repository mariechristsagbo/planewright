// Step handlers for the external interaction driver. Each handler performs one ordinary user
// input or one bounded read of state the session itself created. Nothing here fetches
// application code, assets or source maps. Pointer, keyboard and touch input live in input.mjs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import {
  REFERENCE_ORIGIN,
  checkNavigation,
  fixturePath,
  outputPath,
  safeDownloadName,
} from './guard.mjs';
import { inputHandlers, point, sleep } from './input.mjs';
import { assertMetrics, expectedFromEmulation, readMetrics } from './metrics.mjs';
import { decodePng, encodePng, paintBoxes } from './png.mjs';
import { redactSecrets } from './sanitise.mjs';

const metrics = (ctx) => ctx.page.evaluate(readMetrics);

// Applies device metrics, touch and user agent, then fails the run if the page does not report
// them back. Re-applying emulation on a loaded page has read back a wrong DPR (scenario 11).
async function emulate(ctx, step) {
  await ctx.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: step.width,
    height: step.height,
    deviceScaleFactor: step.deviceScaleFactor ?? 1,
    mobile: step.mobile ?? false,
    // Without these, desktop emulation keeps the headless default screen of 800x600.
    screenWidth: step.width,
    screenHeight: step.height,
  });
  await ctx.cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: step.hasTouch ?? false,
    maxTouchPoints: step.hasTouch ? 5 : 1,
  });
  if (step.userAgent) {
    await ctx.cdp.send('Emulation.setUserAgentOverride', { userAgent: step.userAgent });
  }
  const read = await metrics(ctx);
  return step.verify === false ? read : assertMetrics(expectedFromEmulation(step), read);
}

async function colorScheme(ctx, step) {
  await ctx.cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: step.value },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ],
  });
  return { value: step.value };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Captures the viewport through the driver's own CDP session. Playwright's page.screenshot() was
// found to reset emulated metrics (mobile DPR to 1, screen to 800x600) until the next navigation,
// so it is not used. Masks are painted onto the decoded image in this process: the unmasked bytes
// never reach disk and the page DOM is not touched. When a mask matches nothing, or a `refuseIf`
// selector matches something, nothing is written. Mask boxes (CSS px) and the image/CSS scale
// are returned for offline checks with check-masks.mjs.
async function maskBoxesFor(ctx, selectors) {
  const boxes = [];
  for (const [index, selector] of selectors.entries()) {
    const matches = await ctx.page.locator(selector).all();
    if (matches.length === 0) throw new Error(`Mask ${String(index)} matched nothing.`);
    for (const match of matches) {
      const box = await match.boundingBox();
      if (box) boxes.push(box);
    }
  }
  return boxes;
}

async function screenshot(ctx, step) {
  const file = outputPath(ctx.outDir, 'screenshots', step.name, '.png');
  for (const selector of step.refuseIf ?? []) {
    if ((await ctx.page.locator(selector).count()) > 0) {
      throw new Error('Screenshot refused: a refuseIf selector is present.');
    }
  }
  const maskBoxes = await maskBoxesFor(ctx, step.mask ?? []);
  const cssWidth = await ctx.page.evaluate(() => window.innerWidth);
  const { data } = await ctx.cdp.send('Page.captureScreenshot', { format: 'png' });
  let bytes = Buffer.from(data, 'base64');
  const scale = bytes.readUInt32BE(16) / cssWidth;
  if (maskBoxes.length > 0) bytes = encodePng(paintBoxes(decodePng(bytes), maskBoxes, scale));
  // 'wx': an existing capture is never overwritten, so every name maps to one capture.
  writeFileSync(file, bytes, { flag: 'wx' });
  const size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  const masks = (step.mask ?? []).length;
  return { file: basename(file), sha256: sha256(bytes), masks, maskBoxes, scale, ...size };
}

async function runNested(ctx, steps) {
  if (!Array.isArray(steps)) throw new Error('A trigger needs a steps array.');
  for (const nested of steps) await ctx.run(nested);
}

async function download(ctx, step) {
  const pending = ctx.page.waitForEvent('download', { timeout: step.timeout ?? 15000 });
  await runNested(ctx, step.trigger);
  const item = await pending;
  const file = outputPath(
    ctx.outDir,
    'downloads',
    safeDownloadName(step.name, item.suggestedFilename()),
    '',
  );
  if (existsSync(file)) throw new Error('Download name already used in this session.');
  await item.saveAs(file);
  const bytes = readFileSync(file);
  return {
    suggestedFilename: redactSecrets(item.suggestedFilename()),
    bytes: bytes.length,
    sha256: sha256(bytes),
    head: bytes.subarray(0, 16).toString('hex'),
  };
}

async function fileChooser(ctx, step) {
  const pending = ctx.page.waitForEvent('filechooser', { timeout: step.timeout ?? 8000 });
  await runNested(ctx, step.trigger);
  const chooser = await pending;
  // Only fixture names are accepted; they resolve inside <out>/../fixtures.
  const files = step.files.map((name) => fixturePath(ctx.outDir, name));
  await chooser.setFiles(files);
  return { multiple: chooser.isMultiple(), files: files.map((f) => basename(f)) };
}

// Drops a fixture file onto the canvas the way a desktop file manager drag would.
async function dropFile(ctx, step) {
  const file = fixturePath(ctx.outDir, step.file);
  const payload = {
    b64: readFileSync(file).toString('base64'),
    name: basename(file),
    type: step.mime,
  };
  const transfer = await ctx.page.evaluateHandle(({ b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], name, { type }));
    return data;
  }, payload);
  const at = point(step.at);
  const target = ctx.page.locator('canvas.interactive');
  const init = { dataTransfer: transfer, clientX: at.x, clientY: at.y };
  await target.dispatchEvent('dragover', init);
  await target.dispatchEvent('drop', init);
  return { file: payload.name, at };
}

// Accepts the next native dialog (alert/confirm/prompt) and records its type and message.
async function acceptDialog(ctx, step) {
  const pending = ctx.page.waitForEvent('dialog', { timeout: step.timeout ?? 5000 });
  await runNested(ctx, step.trigger);
  const dialog = await pending;
  const seen = { type: dialog.type(), message: redactSecrets(dialog.message()) };
  await dialog.accept();
  return seen;
}

async function role(ctx, step) {
  const locator = ctx.page.getByRole(step.role, { name: step.name, exact: step.exact ?? false });
  const target = step.nth === undefined ? locator.first() : locator.nth(step.nth);
  await target.click({ timeout: step.timeout ?? 5000 });
  return { role: step.role, name: step.name };
}

// ARIA text can contain collaboration links; it is redacted before it is written or returned.
async function aria(ctx, step) {
  const text = redactSecrets(await ctx.page.locator(step.selector ?? 'body').ariaSnapshot());
  if (step.save) {
    writeFileSync(outputPath(ctx.outDir, 'aria', step.save, '.yml'), text, { flag: 'wx' });
  }
  return { lines: text.split('\n').length, preview: step.save ? undefined : text };
}

// Loads a self-authored HTML fixture from <out>/../fixtures as the page content.
async function fixture(ctx, step) {
  if (!String(step.name).endsWith('.html')) throw new Error('A fixture page must be .html.');
  const html = readFileSync(fixturePath(ctx.outDir, step.name), 'utf8');
  await ctx.page.goto('about:blank');
  await ctx.page.setContent(html, { waitUntil: 'load' });
  return { fixture: step.name };
}

export const handlers = {
  ...inputHandlers,
  emulate,
  colorScheme,
  metrics,
  assertMetrics: async (ctx, step) => assertMetrics(step.expect ?? {}, await metrics(ctx)),
  goto: async (ctx, step) => {
    const url = checkNavigation(step.url);
    const response = await ctx.page.goto(url, { waitUntil: step.waitUntil ?? 'load' });
    return { status: response?.status() ?? null };
  },
  fixture,
  reload: async (ctx) => ({ status: (await ctx.page.reload())?.status() ?? null }),
  role,
  selector: async (ctx, step) => {
    await ctx.page
      .locator(step.selector)
      .first()
      .click({ timeout: step.timeout ?? 5000 });
    return { selector: step.selector };
  },
  wait: async (_ctx, step) => {
    if (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 60000) {
      throw new Error('wait needs an integer ms from 0 to 60000.');
    }
    return sleep(step.ms).then(() => ({ ms: step.ms }));
  },
  screenshot,
  download,
  fileChooser,
  dropFile,
  acceptDialog,
  aria,
  grantClipboard: async (ctx, step) => {
    if (step.origin !== undefined && step.origin !== REFERENCE_ORIGIN) {
      throw new Error('Clipboard permission is granted to the reference origin only.');
    }
    await ctx.page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], { origin: REFERENCE_ORIGIN });
    return { granted: true };
  },
};
