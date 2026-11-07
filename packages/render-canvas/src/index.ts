/**
 * The public entry of `@planewright/render-canvas`, the Canvas 2D implementation of the engine's
 * renderer port (ADR 0006). It depends on `@planewright/engine` only.
 */
export { createCanvasRenderer } from './renderer.ts';
export type { CanvasRendererOptions } from './renderer.ts';
export type { CanvasSurface, Context2D } from './canvas.ts';
