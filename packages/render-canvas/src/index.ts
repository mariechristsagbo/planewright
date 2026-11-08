/**
 * The public entry of `@planewright/render-canvas`, the Canvas 2D implementation of the engine's
 * renderer port (ADR 0006), and the fonts it draws texts with (ADR 0011). It depends on
 * `@planewright/engine` only.
 */
export { canvasFont, FONT_STACKS } from './fonts.ts';
export { createCanvasRenderer } from './renderer.ts';
export type { CanvasRendererOptions } from './renderer.ts';
export type { CanvasSurface, Context2D } from './canvas.ts';
