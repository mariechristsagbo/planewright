// Bounded reads of state created by the research session itself: storage key inventory,
// a structural summary of the locally persisted scene, clipboard text shape, the URL shape and
// the computed style of the document root. Values are reduced to shapes, counts and geometry.
// The focus, connectivity and layout reads of s59 on live in view-probes.mjs.
import { clipboardShapeOf, urlShapeOf } from './sanitise.mjs';
import { viewProbes } from './view-probes.mjs';

function summariseStorage() {
  const describe = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { kind: 'array', length: parsed.length };
      if (parsed && typeof parsed === 'object')
        return { kind: 'object', keys: Object.keys(parsed) };
      return { kind: typeof parsed };
    } catch {
      return { kind: 'text' };
    }
  };
  const read = (store) =>
    Object.keys(store)
      .sort()
      .map((key) => ({ key, chars: store.getItem(key).length, ...describe(store.getItem(key)) }));
  return { localStorage: read(localStorage), sessionStorage: read(sessionStorage) };
}

function summariseScene(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return { present: false };
  const round = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);
  // A link keeps its origin and path only (an HTTP(S) URL), or its scheme or length.
  const linkShape = (link) => {
    try {
      const url = new URL(link);
      const web = url.protocol === 'https:' || url.protocol === 'http:';
      return web ? { origin: url.origin, path: url.pathname } : { scheme: url.protocol };
    } catch {
      return { unparseable: true, chars: String(link).length };
    }
  };
  // Stroke options as read when their JSON is short, else that JSON's length only.
  const brief = (value) => {
    const text = JSON.stringify(value);
    return text.length <= 160 ? value : { jsonChars: text.length };
  };
  // Read only by the probes of later sessions; undefined, so left out, when an element has none.
  const later = (e) => ({
    link: e.link ? linkShape(e.link) : undefined,
    simulatePressure: e.simulatePressure,
    pressures: Array.isArray(e.pressures) ? e.pressures.length : undefined,
    strokeOptions: e.strokeOptions === undefined ? undefined : brief(e.strokeOptions),
  });
  const elements = JSON.parse(raw).map((e) => ({
    type: e.type,
    x: round(e.x),
    y: round(e.y),
    width: round(e.width),
    height: round(e.height),
    angle: round(e.angle),
    isDeleted: e.isDeleted,
    groups: e.groupIds?.length ?? 0,
    bound: e.boundElements?.map((b) => b.type) ?? [],
    startBound: Boolean(e.startBinding),
    endBound: Boolean(e.endBinding),
    container: Boolean(e.containerId),
    textLength: typeof e.text === 'string' ? e.text.length : undefined,
    points: Array.isArray(e.points) ? e.points.length : undefined,
    // Only arrows carry it; a sharp and an elbow arrow both have no roundness.
    elbowed: e.elbowed,
    ...later(e),
    strokeColor: e.strokeColor,
    backgroundColor: e.backgroundColor,
    fillStyle: e.fillStyle,
    strokeWidth: e.strokeWidth,
    strokeStyle: e.strokeStyle,
    roughness: e.roughness,
    opacity: e.opacity,
    roundness: e.roundness ? e.roundness.type : null,
    fontSize: e.fontSize,
    fontFamily: e.fontFamily,
    textAlign: e.textAlign,
    locked: e.locked,
    keys: Object.keys(e).sort(),
  }));
  return { present: true, count: elements.length, elements };
}

function summariseAppState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return { present: false };
  const state = JSON.parse(raw);
  const pick = [
    'theme',
    'zoom',
    'scrollX',
    'scrollY',
    'gridSize',
    'gridModeEnabled',
    'zenModeEnabled',
    'viewModeEnabled',
    'objectsSnapModeEnabled',
    'currentItemStrokeColor',
    'currentItemBackgroundColor',
    'currentItemFillStyle',
    'currentItemStrokeWidth',
    'currentItemRoughness',
    'currentItemOpacity',
    'currentItemFontFamily',
    'currentItemFontSize',
    'activeTool',
    'selectedElementIds',
    'name',
    // Read from s59 on (the canvas background, R-05).
    'viewBackgroundColor',
  ];
  const selected = Object.fromEntries(pick.filter((k) => k in state).map((k) => [k, state[k]]));
  if (selected.name) selected.name = `<${String(selected.name).length} chars>`;
  return {
    present: true,
    keyCount: Object.keys(state).length,
    keys: Object.keys(state).sort(),
    selected,
  };
}

function rootStyle() {
  const root = document.documentElement;
  const body = getComputedStyle(document.body);
  return {
    htmlClass: root.className,
    bodyBackground: body.backgroundColor,
    colorScheme: getComputedStyle(root).colorScheme,
    canvases: [...document.querySelectorAll('canvas')].map((c) => ({
      cls: c.className,
      width: c.width,
      height: c.height,
      cssWidth: c.style.width,
      cssHeight: c.style.height,
    })),
    focused: document.activeElement?.tagName ?? null,
    focusedLabel: document.activeElement?.getAttribute('aria-label') ?? null,
  };
}

// The href stays in memory: only its shape (key names and value lengths) is returned.
async function urlProbe(ctx) {
  return urlShapeOf(await ctx.page.evaluate(() => location.href));
}

// The clipboard text stays in this process: it is shaped and redacted here before anything is
// returned, and the preview is cut only after redaction.
async function clipboardProbe(ctx) {
  return clipboardShapeOf(await ctx.page.evaluate(() => navigator.clipboard.readText()));
}

export const probes = {
  url: urlProbe,
  storage: async (ctx) => ctx.page.evaluate(summariseStorage),
  scene: async (ctx, step) => ctx.page.evaluate(summariseScene, step.key ?? 'excalidraw'),
  appState: async (ctx, step) =>
    ctx.page.evaluate(summariseAppState, step.key ?? 'excalidraw-state'),
  clipboard: clipboardProbe,
  rootStyle: async (ctx) => ctx.page.evaluate(rootStyle),
  ...viewProbes,
};
