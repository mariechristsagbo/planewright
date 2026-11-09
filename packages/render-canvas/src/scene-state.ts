import type { Context2D } from './canvas.ts';

// The scene layer's drawing state (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

/** The ends of a stroke: round for lines and freehand strokes, a closed outline's defaults otherwise. */
export type LineEnds = 'round' | 'closed';

/**
 * The state that the scene layer draws an element with, set on its context only when it differs
 * from what this frame has set already. Each frame starts knowing nothing, so it sets every state
 * it uses at least once, whatever an earlier frame, a resize or a lost context left behind.
 * Every value comes from an element that the scene store has checked, so the context takes it.
 */
export interface SceneState {
  alpha(value: number): void;
  fillStyle(value: string): void;
  /** The stroke colour, width, dash pattern and ends. */
  stroke(color: string, width: number, dash: readonly number[], ends: LineEnds): void;
  /** The font and alignment of a text, centred on its lines. */
  text(font: string, align: CanvasTextAlign): void;
}

/**
 * Whether the dash pattern set is the pattern given, step by step. It runs for every stroke, so it
 * compares by index rather than through an iterator, which allocates.
 */
function sameDash(set: readonly number[] | undefined, dash: readonly number[]): boolean {
  if (set?.length !== dash.length) return false;
  for (let at = 0; at < dash.length; at += 1) if (set[at] !== dash[at]) return false;
  return true;
}

/**
 * What the frame has set, undefined until it sets it. Every field is there from the start, so
 * that the object keeps one shape whatever a frame sets first.
 */
interface Known {
  alpha: number | undefined;
  fill: string | undefined;
  stroke: string | undefined;
  width: number | undefined;
  dash: readonly number[] | undefined;
  ends: LineEnds | undefined;
  font: string | undefined;
  align: CanvasTextAlign | undefined;
  baseline: boolean;
}

function setEnds(context: Context2D, known: Known, ends: LineEnds): void {
  if (known.ends === ends) return;
  known.ends = ends;
  context.lineCap = ends === 'round' ? 'round' : 'butt';
  context.lineJoin = ends === 'round' ? 'round' : 'miter';
}

/** The state of one frame on a scene context, which knows nothing yet. */
export function sceneState(context: Context2D): SceneState {
  const known: Known = {
    alpha: undefined,
    fill: undefined,
    stroke: undefined,
    width: undefined,
    dash: undefined,
    ends: undefined,
    font: undefined,
    align: undefined,
    baseline: false,
  };
  return {
    alpha(value) {
      if (known.alpha === value) return;
      known.alpha = value;
      context.globalAlpha = value;
    },
    fillStyle(value) {
      if (known.fill === value) return;
      known.fill = value;
      context.fillStyle = value;
    },
    stroke(color, width, dash, ends) {
      if (known.stroke !== color) {
        known.stroke = color;
        context.strokeStyle = color;
      }
      if (known.width !== width) {
        known.width = width;
        context.lineWidth = width;
      }
      if (!sameDash(known.dash, dash)) {
        known.dash = dash;
        context.setLineDash(dash);
      }
      setEnds(context, known, ends);
    },
    text(font, align) {
      if (known.font !== font) {
        known.font = font;
        context.font = font;
      }
      if (known.align !== align) {
        known.align = align;
        context.textAlign = align;
      }
      if (known.baseline) return;
      known.baseline = true;
      context.textBaseline = 'middle';
    },
  };
}
