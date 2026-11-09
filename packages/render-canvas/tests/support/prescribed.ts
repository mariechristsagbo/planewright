import type { Element, RenderFrame } from '@planewright/engine';

import { FONT_STACKS } from '../../src/fonts.ts';
import type { PathCache } from '../../src/path-cache.ts';
import { DEFAULT_STATE, rotated, stateFor, translated } from './canvas-state.ts';
import type { CanvasState, Draw, Matrix } from './canvas-state.ts';
import type { RecordingPath } from './recording.ts';

// What each element draws and with which state, by the drawing rules
// (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer), as if each
// element were drawn in a state of its own saved from a fresh context's defaults. Only its path
// and its text layout come from the renderer's cache, whose own tests check them.

/** The transform that places an element, by the rules: scale, the origin from the camera, the turn. */
function placement(
  drawing: { element: Element; width: number; height: number },
  frame: RenderFrame,
): Matrix {
  const { element, width, height } = drawing;
  const scale = frame.viewport.pixelRatio * frame.camera.zoom;
  const placed: Matrix = [
    scale,
    0,
    0,
    scale,
    scale * (element.x - frame.camera.x),
    scale * (element.y - frame.camera.y),
  ];
  if (element.rotation === 0) return placed;
  return translated(
    rotated(translated(placed, width / 2, height / 2), element.rotation),
    -width / 2,
    -height / 2,
  );
}

const DASH_STEPS = { solid: [], dashed: [4, 4], dotted: [1, 2] } as const;
const ANCHOR = { left: 0, center: 0.5, right: 1 } as const;
/** The kinds whose outline is closed, so that a fill applies: a text's box too. */
const CLOSED: ReadonlySet<Element['kind']> = new Set(['rectangle', 'ellipse', 'diamond', 'text']);

type Layout = NonNullable<NonNullable<ReturnType<PathCache['peek']>>['text']>['layout'] | null;

/** A text's lines, each in its stroke colour, anchored by its alignment, centred on its line. */
function textDraws(element: Element, base: CanvasState, layout: Layout): Draw[] {
  if (element.kind !== 'text' || layout === null) return [];
  const { align, font } = element.content;
  const state = {
    ...base,
    fillStyle: element.style.stroke.color,
    font: `${String(font.size)}px ${FONT_STACKS[font.family]}`,
    textAlign: align,
    textBaseline: 'middle',
  };
  return layout.lines.map((each, index) => ({
    call: ['fillText', each.text, ANCHOR[align] * element.width, (index + 0.5) * layout.lineHeight],
    state: stateFor('fillText', state),
  }));
}

/** A stroke: round ends for lines and freehand strokes, a dash pattern in stroke widths. */
function strokeDraw(element: Element, base: CanvasState, path: string): Draw {
  const { stroke } = element.style;
  const ends = CLOSED.has(element.kind)
    ? { lineCap: 'butt', lineJoin: 'miter' }
    : { lineCap: 'round', lineJoin: 'round' };
  const lineDash = DASH_STEPS[stroke.dash].map((each) => each * stroke.width);
  const state = { ...base, ...ends, strokeStyle: stroke.color, lineWidth: stroke.width, lineDash };
  return { call: ['stroke', path], state: stateFor('stroke', state) };
}

/**
 * The draws of an element that the cache holds, each with the state that the element prescribes:
 * a one-point stroke's disc, or a fill under a closed kind's stroke or a text's lines.
 */
export function prescribed(cache: PathCache, element: Element, frame: RenderFrame): Draw[] {
  const drawing = cache.peek(element.id);
  if (drawing === undefined) return [];
  const { style } = element;
  const path = `path ${String((drawing.path as unknown as RecordingPath).id)}`;
  const base = {
    ...DEFAULT_STATE,
    transform: placement(drawing, frame),
    globalAlpha: style.opacity,
  };
  const filled = (fillStyle: string): Draw => ({
    call: ['fill', path],
    state: stateFor('fill', { ...base, fillStyle }),
  });
  if (element.kind === 'freehand' && element.points.length === 1)
    return [filled(style.stroke.color)];
  const fill = CLOSED.has(element.kind) && style.fill !== null ? [filled(style.fill.color)] : [];
  if (element.kind === 'text')
    return [...fill, ...textDraws(element, base, drawing.text?.layout ?? null)];
  return [...fill, strokeDraw(element, base, path)];
}
