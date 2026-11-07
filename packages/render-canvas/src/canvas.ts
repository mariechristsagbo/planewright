// The part of Canvas 2D that the renderer uses, so that tests can record it in Node.js
// (ADR 0006, consequences). A browser's canvas and its 2D context have all of it.

/** The calls and properties of a 2D context that the renderer draws with. */
export type Context2D = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'translate'
  | 'rotate'
  | 'clearRect'
  | 'fillRect'
  | 'strokeRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'fillText'
  | 'setLineDash'
  | 'globalAlpha'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>;

/** A canvas whose backing store the renderer sizes and draws on. */
export interface CanvasSurface {
  width: number;
  height: number;
  getContext(contextId: '2d'): Context2D | null;
}

/** The calls that an outline is traced into a path with. */
export type PathSink = Pick<Path2D, 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'closePath' | 'arc'>;
