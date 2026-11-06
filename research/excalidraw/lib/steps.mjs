// Step handlers for the external interaction driver. Each handler performs one ordinary user
// input or one bounded read of state the session itself created. Nothing here fetches
// application code, assets or source maps. Pointer, keyboard and touch input live in input.mjs.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { screenshot } from './capture.mjs';
import { streamExclusive, writeExclusive } from './files.mjs';
import {
  REFERENCE_ORIGIN,
  checkNavigation,
  fixturePath,
  isAllowedNavigation,
  outputPath,
  safeDownloadName,
} from './guard.mjs';
import { inputHandlers, point, sleep } from './input.mjs';
import {
  FatalStepError,
  assertMetrics,
  expectedFromEmulation,
  readMetrics,
  screenOrientation,
} from './metrics.mjs';
import { redactSecrets, sanitiseUrl } from './sanitise.mjs';

const metrics = (ctx) => ctx.page.evaluate(readMetrics);

// Applies device metrics, touch and user agent, then fails the run if the page does not report
// them back. Re-applying emulation on a loaded page has read back a wrong DPR (scenario 11).
async function emulate(ctx, step) {
  // Checked before any CDP call, so an invalid orientation changes nothing.
  const orientation = screenOrientation(step);
  await ctx.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: step.width,
    height: step.height,
    deviceScaleFactor: step.deviceScaleFactor ?? 1,
    mobile: step.mobile ?? false,
    // Without these, desktop emulation keeps the headless default screen of 800x600.
    screenWidth: step.width,
    screenHeight: step.height,
    ...(orientation && { screenOrientation: orientation }),
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

// Emulates a lost connection (R-57, from s59 on) through Playwright's context, which sends the CDP
// network conditions to the page and to every service worker it has attached, then reads
// navigator.onLine back for up to a second. A read that disagrees stops the batch, as a metrics
// mismatch does. Nothing else is changed, the user agent included.
// Playwright skips a value its context already holds, but an offline reload left navigator.onLine
// true (s60, s63), so the same conditions also go to the page on the driver's own CDP session:
// repeating the step after a reload applies it again.
async function offline(ctx, step) {
  if (typeof step.value !== 'boolean') throw new FatalStepError('offline needs a boolean value.');
  const context = ctx.page.context();
  await context.setOffline(step.value);
  await ctx.cdp.send('Network.emulateNetworkConditions', {
    offline: step.value,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  let onLine = step.value;
  for (let i = 0; i < 10 && onLine === step.value; i += 1) {
    if (i > 0) await sleep(100);
    onLine = await ctx.page.evaluate(() => navigator.onLine);
  }
  if (onLine === step.value) {
    throw new FatalStepError(
      `Offline emulation not read back, run aborted: navigator.onLine is ${String(onLine)}.`,
    );
  }
  // The browser runs workers of its own too, so each worker is named by its origin and path.
  const workers = context.serviceWorkers().map((worker) => {
    const { origin, path, scheme } = sanitiseUrl(worker.url());
    return origin ? `${origin}${path}` : String(scheme ?? 'unparseable');
  });
  return { offline: step.value, onLine, serviceWorkers: workers };
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

async function runNested(ctx, steps) {
  if (!Array.isArray(steps)) throw new Error('A trigger needs a steps array.');
  for (const nested of steps) await ctx.run(nested);
}

// Waits for a page event that the step's trigger causes. The waiter starts first so the event
// cannot be missed, and it always has a handler: when the trigger fails, the waiter's later
// timeout must not become an unhandled rejection, which would stop the driver process.
async function eventAfterTrigger(ctx, step, event, timeout) {
  const pending = ctx.page.waitForEvent(event, { timeout: step.timeout ?? timeout });
  pending.catch(() => undefined);
  await runNested(ctx, step.trigger);
  return pending;
}

async function download(ctx, step) {
  const item = await eventAfterTrigger(ctx, step, 'download', 15000);
  const file = outputPath(
    ctx.outDir,
    'downloads',
    safeDownloadName(step.name, item.suggestedFilename()),
    '',
  );
  // O_EXCL: a name already used in this session fails with EEXIST and its file stays intact.
  await streamExclusive(await item.createReadStream(), file);
  const bytes = readFileSync(file);
  return {
    suggestedFilename: redactSecrets(item.suggestedFilename()),
    bytes: bytes.length,
    sha256: sha256(bytes),
    head: bytes.subarray(0, 16).toString('hex'),
  };
}

async function fileChooser(ctx, step) {
  const chooser = await eventAfterTrigger(ctx, step, 'filechooser', 8000);
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
  const dialog = await eventAfterTrigger(ctx, step, 'dialog', 5000);
  const seen = { type: dialog.type(), message: redactSecrets(dialog.message()) };
  await dialog.accept();
  return seen;
}

// With unlessExpanded true, an item that already reports aria-expanded="true" is left alone, so
// a menu reopened with its submenu still expanded does not collapse it (Preferences, s71 on).
async function role(ctx, step) {
  const locator = ctx.page.getByRole(step.role, { name: step.name, exact: step.exact ?? false });
  const target = step.nth === undefined ? locator.first() : locator.nth(step.nth);
  const timeout = step.timeout ?? 5000;
  if (step.unlessExpanded === true) {
    if ((await target.getAttribute('aria-expanded', { timeout })) === 'true') {
      return { role: step.role, name: step.name, skipped: 'expanded' };
    }
  }
  await target.click({ timeout });
  return { role: step.role, name: step.name };
}

// Picks one option of a select element by its visible label, as a user does (the language list).
async function selectOption(ctx, step) {
  if (typeof step.label !== 'string' || step.label.length === 0) {
    throw new Error('selectOption needs an option label.');
  }
  const role = step.role ?? 'combobox';
  const locator = ctx.page.getByRole(role, { name: step.name, exact: step.exact ?? false });
  const values = await locator
    .first()
    .selectOption({ label: step.label }, { timeout: step.timeout ?? 5000 });
  return { role, name: step.name, label: step.label, values };
}

// ARIA text can contain collaboration links; it is redacted before it is written or returned.
async function aria(ctx, step) {
  const text = redactSecrets(await ctx.page.locator(step.selector ?? 'body').ariaSnapshot());
  if (step.save) {
    writeExclusive(outputPath(ctx.outDir, 'aria', step.save, '.yml'), text);
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
  offline,
  colorScheme,
  metrics,
  assertMetrics: async (ctx, step) => assertMetrics(step.expect ?? {}, await metrics(ctx)),
  goto: async (ctx, step) => {
    const url = checkNavigation(step.url);
    const response = await ctx.page.goto(url, { waitUntil: step.waitUntil ?? 'load' });
    // A redirect can end anywhere; landing off the allowlist stops the batch.
    if (!isAllowedNavigation(ctx.page.url())) {
      throw new FatalStepError('Navigation left the allowlist after goto.');
    }
    return { status: response?.status() ?? null };
  },
  fixture,
  reload: async (ctx) => ({ status: (await ctx.page.reload())?.status() ?? null }),
  role,
  selectOption,
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
