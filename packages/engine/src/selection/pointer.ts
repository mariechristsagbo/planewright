// Pointer kinds and the screen distances that depend on them
// (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing). The input layer reports
// the kind with each pointer event; it is defined here, in the lowest layer that needs it.

export type PointerKind = 'mouse' | 'pen' | 'touch';

/** How far beyond its stroke a press still hits an element, in screen pixels (REQ-S03). */
export const HIT_TOLERANCE: Readonly<Record<PointerKind, number>> = { mouse: 5, pen: 5, touch: 6 };
