// Reads for the keyboard, offline and layout observations of s59 on: the focused element and the
// live regions (R-27), the connection and service worker state (R-57), and the document language
// and the boxes of named buttons at the current viewport (R-23). Like probes.mjs, they read only
// what the page itself shows: an element's text is reduced to its length, and only accessible
// labels, states and computed focus styles are kept. A live region's text is kept, cut to 80
// characters, because it is what the page announces; the summaries copy only its length.

/** Runs in the page. The focused element (or the body) and every live region. */
export function focusState() {
  const squash = (text) => (text ?? '').replace(/\s+/gu, ' ').trim();
  const STATES = ['aria-pressed', 'aria-expanded', 'aria-checked', 'aria-selected'];
  STATES.push('aria-haspopup', 'aria-disabled');
  const describe = (e) => {
    if (!e || e === document.body || e === document.documentElement) {
      return { tag: e?.tagName ?? null, body: true };
    }
    const style = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      tag: e.tagName,
      type: e.getAttribute('type'),
      role: e.getAttribute('role'),
      name: e.getAttribute('aria-label') ?? e.getAttribute('title'),
      textChars: squash(e.textContent).length,
      tabIndex: e.tabIndex,
      states: STATES.filter((a) => e.hasAttribute(a)).map((a) => `${a}=${e.getAttribute(a)}`),
      disabled: e.disabled === true,
      focusVisible: e.matches(':focus-visible'),
      outline: [style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset],
      boxShadow: style.boxShadow.slice(0, 120),
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      inDialog: e.closest('[role=dialog], dialog') !== null,
      inMenu: e.closest('[role=menu]') !== null,
    };
  };
  const regions = document.querySelectorAll('[aria-live], [role=status], [role=alert], [role=log]');
  const live = [...regions].map((e) => ({
    role: e.getAttribute('role'),
    live: e.getAttribute('aria-live'),
    chars: squash(e.textContent).length,
    text: squash(e.textContent).slice(0, 80),
  }));
  return { focused: describe(document.activeElement), live };
}

/** Runs in the page. Whether it reports a connection, and its service worker's state. */
export async function connectivityState() {
  const workers = navigator.serviceWorker;
  const registration = workers ? await workers.getRegistration() : undefined;
  const state = (worker) => worker?.state ?? null;
  return {
    onLine: navigator.onLine,
    controlled: Boolean(workers?.controller),
    registration: registration
      ? {
          scope: new URL(registration.scope).pathname,
          active: state(registration.active),
          waiting: state(registration.waiting),
          installing: state(registration.installing),
        }
      : null,
    readyState: document.readyState,
  };
}

/** Runs in the page. The viewport, the document language and direction, the app root's class. */
export function documentLayout() {
  const root = document.querySelector('.excalidraw');
  return {
    viewport: [window.innerWidth, window.innerHeight],
    lang: document.documentElement.lang || null,
    dir: document.documentElement.dir || null,
    appClass: root ? root.className : null,
  };
}

const box = (b) => (b ? [b.x, b.y, b.width, b.height].map(Math.round) : null);

// The boxes of every button with each exact accessible name, null for one that is not rendered.
async function layout(ctx, step) {
  const names = step.buttons ?? [];
  const valid = (name) => typeof name === 'string' && name.length > 0 && name.length <= 60;
  if (!Array.isArray(names) || names.length > 20 || !names.every(valid)) {
    throw new Error('layout needs up to 20 button names of 1 to 60 characters.');
  }
  const buttons = [];
  for (const name of names) {
    const found = await ctx.page.getByRole('button', { name, exact: true }).all();
    buttons.push({
      name,
      boxes: await Promise.all(found.map(async (l) => box(await l.boundingBox()))),
    });
  }
  return { ...(await ctx.page.evaluate(documentLayout)), buttons };
}

export const viewProbes = {
  focus: async (ctx) => ctx.page.evaluate(focusState),
  connectivity: async (ctx) => ctx.page.evaluate(connectivityState),
  layout,
};
