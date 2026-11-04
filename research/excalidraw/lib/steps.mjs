// Step handlers for the external interaction driver. Each handler performs one ordinary user
// input (pointer, keyboard, wheel, touch) or one bounded read of state the session itself
// created. Nothing here fetches application code, assets or source maps.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function point(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) {
    throw new Error(`Expected an [x, y] point, received ${JSON.stringify(value)}`);
  }
  return { x: value[0], y: value[1] };
}

async function withModifiers(page, modifiers, action) {
  const keys = modifiers ?? [];
  for (const key of keys) await page.keyboard.down(key);
  try {
    return await action();
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

async function drag(ctx, step) {
  const from = point(step.from);
  const to = point(step.to);
  const { mouse } = ctx.page;
  await withModifiers(ctx.page, step.modifiers, async () => {
    await mouse.move(from.x, from.y);
    await mouse.down({ button: step.button ?? 'left' });
    await mouse.move(to.x, to.y, { steps: step.steps ?? 12 });
    await mouse.up({ button: step.button ?? 'left' });
  });
  return { from, to };
}

async function path(ctx, step) {
  const points = step.points.map(point);
  const [first, ...rest] = points;
  if (!first) throw new Error('path needs at least one point');
  await ctx.page.mouse.move(first.x, first.y);
  await ctx.page.mouse.down();
  for (const next of rest) await ctx.page.mouse.move(next.x, next.y, { steps: 4 });
  await ctx.page.mouse.up();
  return { points: points.length };
}

async function click(ctx, step) {
  const at = point(step.at);
  await withModifiers(ctx.page, step.modifiers, () =>
    ctx.page.mouse.click(at.x, at.y, {
      button: step.button ?? 'left',
      clickCount: step.clickCount ?? 1,
    }),
  );
  return { at };
}

async function touch(ctx, type, points) {
  await ctx.cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })),
  });
}

async function touchDrag(ctx, step) {
  const from = step.from.map(point);
  const to = step.to.map(point);
  const steps = step.steps ?? 10;
  await touch(ctx, 'touchStart', from);
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const current = from.map((p, k) => ({
      x: p.x + (to[k].x - p.x) * t,
      y: p.y + (to[k].y - p.y) * t,
    }));
    await touch(ctx, 'touchMove', current);
    await sleep(16);
  }
  await touch(ctx, 'touchEnd', []);
  return { fingers: from.length };
}

async function tap(ctx, step) {
  const at = point(step.at);
  await touch(ctx, 'touchStart', [at]);
  await sleep(40);
  await touch(ctx, 'touchEnd', []);
  return { at };
}

async function emulate(ctx, step) {
  await ctx.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: step.width,
    height: step.height,
    deviceScaleFactor: step.deviceScaleFactor ?? 1,
    mobile: step.mobile ?? false,
  });
  await ctx.cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: step.hasTouch ?? false,
    maxTouchPoints: step.hasTouch ? 5 : 1,
  });
  if (step.userAgent) {
    await ctx.cdp.send('Emulation.setUserAgentOverride', { userAgent: step.userAgent });
  }
  return metrics(ctx);
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

function metrics(ctx) {
  return ctx.page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    maxTouchPoints: navigator.maxTouchPoints,
  }));
}

async function screenshot(ctx, step) {
  const file = join(ctx.outDir, 'screenshots', `${step.name}.png`);
  const bytes = await ctx.page.screenshot({ path: file });
  const size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  return { file: basename(file), sha256: sha256(bytes), ...size };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function download(ctx, step) {
  const pending = ctx.page.waitForEvent('download', { timeout: step.timeout ?? 15000 });
  await runNested(ctx, step.trigger);
  const item = await pending;
  const file = join(ctx.outDir, 'downloads', `${step.name}-${item.suggestedFilename()}`);
  await item.saveAs(file);
  const bytes = readFileSync(file);
  return {
    suggestedFilename: item.suggestedFilename(),
    bytes: bytes.length,
    sha256: sha256(bytes),
    head: bytes.subarray(0, 16).toString('hex'),
  };
}

async function fileChooser(ctx, step) {
  const pending = ctx.page.waitForEvent('filechooser', { timeout: step.timeout ?? 8000 });
  await runNested(ctx, step.trigger);
  const chooser = await pending;
  // Relative fixture names resolve to <out>/../fixtures so scenarios carry no local paths.
  await chooser.setFiles(
    step.files.map((f) => (isAbsolute(f) ? f : join(ctx.outDir, '..', 'fixtures', f))),
  );
  return { multiple: chooser.isMultiple(), files: step.files.map((f) => basename(f)) };
}

// Drops a fixture file onto the canvas the way a desktop file manager drag would.
async function dropFile(ctx, step) {
  const file = isAbsolute(step.file) ? step.file : join(ctx.outDir, '..', 'fixtures', step.file);
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
  const seen = { type: dialog.type(), message: dialog.message() };
  await dialog.accept();
  return seen;
}

async function runNested(ctx, steps) {
  for (const nested of steps) await ctx.run(nested);
}

async function role(ctx, step) {
  const locator = ctx.page.getByRole(step.role, { name: step.name, exact: step.exact ?? false });
  const target = step.nth === undefined ? locator.first() : locator.nth(step.nth);
  await target.click({ timeout: step.timeout ?? 5000 });
  return { role: step.role, name: step.name };
}

async function aria(ctx, step) {
  const text = await ctx.page.locator(step.selector ?? 'body').ariaSnapshot();
  if (step.save) writeFileSync(join(ctx.outDir, 'aria', `${step.save}.yml`), text);
  return { lines: text.split('\n').length, preview: step.save ? undefined : text };
}

export const handlers = {
  emulate,
  colorScheme,
  metrics,
  goto: async (ctx, step) => {
    const response = await ctx.page.goto(step.url, { waitUntil: step.waitUntil ?? 'load' });
    return { status: response?.status() ?? null };
  },
  reload: async (ctx) => ({ status: (await ctx.page.reload())?.status() ?? null }),
  click,
  move: async (ctx, step) => {
    const at = point(step.at);
    await ctx.page.mouse.move(at.x, at.y, { steps: step.steps ?? 1 });
    return { at };
  },
  drag,
  path,
  key: async (ctx, step) => {
    await ctx.page.keyboard.press(step.key);
    return { key: step.key };
  },
  keyDown: async (ctx, step) => ctx.page.keyboard.down(step.key).then(() => ({ key: step.key })),
  keyUp: async (ctx, step) => ctx.page.keyboard.up(step.key).then(() => ({ key: step.key })),
  type: async (ctx, step) => {
    await ctx.page.keyboard.type(step.text, { delay: step.delay ?? 20 });
    return { chars: step.text.length };
  },
  wheel: async (ctx, step) => {
    const at = point(step.at);
    await ctx.page.mouse.move(at.x, at.y);
    await withModifiers(ctx.page, step.modifiers, () =>
      ctx.page.mouse.wheel(step.dx ?? 0, step.dy ?? 0),
    );
    return { at, dx: step.dx ?? 0, dy: step.dy ?? 0 };
  },
  tap,
  touchDrag,
  role,
  selector: async (ctx, step) => {
    await ctx.page
      .locator(step.selector)
      .first()
      .click({ timeout: step.timeout ?? 5000 });
    return { selector: step.selector };
  },
  wait: async (_ctx, step) => sleep(step.ms).then(() => ({ ms: step.ms })),
  screenshot,
  download,
  fileChooser,
  dropFile,
  acceptDialog,
  aria,
};
