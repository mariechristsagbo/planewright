// Ordinary user-input steps for the external interaction driver: pointer, keyboard, wheel and
// touch. Each handler performs one input that REA cannot express on a canvas.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function point(value) {
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

// One finger through every point in order, `steps` moves per segment (1 to 50, default 4), so a
// stroke can bend; touchDrag moves its fingers in straight lines only.
async function touchPath(ctx, step) {
  const steps = step.steps ?? 4;
  if (!Array.isArray(step.points) || step.points.length < 2) {
    throw new Error('touchPath needs at least two points.');
  }
  if (!Number.isInteger(steps) || steps < 1 || steps > 50) {
    throw new Error('touchPath needs an integer steps from 1 to 50.');
  }
  const points = step.points.map(point);
  await touch(ctx, 'touchStart', [points[0]]);
  for (const [k, to] of points.slice(1).entries()) {
    const from = points[k];
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      await touch(ctx, 'touchMove', [
        { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      ]);
      await sleep(16);
    }
  }
  await touch(ctx, 'touchEnd', []);
  return { points: points.length };
}

async function tap(ctx, step) {
  const at = point(step.at);
  await touch(ctx, 'touchStart', [at]);
  await sleep(40);
  await touch(ctx, 'touchEnd', []);
  return { at };
}

async function wheel(ctx, step) {
  const at = point(step.at);
  await ctx.page.mouse.move(at.x, at.y);
  await withModifiers(ctx.page, step.modifiers, () =>
    ctx.page.mouse.wheel(step.dx ?? 0, step.dy ?? 0),
  );
  return { at, dx: step.dx ?? 0, dy: step.dy ?? 0 };
}

export const inputHandlers = {
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
  wheel,
  tap,
  touchDrag,
  touchPath,
};
