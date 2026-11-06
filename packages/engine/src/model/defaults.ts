import { toColor } from './color.ts';
import type { ElementKind } from './elements.ts';
import type { Style } from './style.ts';

/** The editor's default style when it starts: Planewright's own values (REQ-C12). */
export const INITIAL_DEFAULT_STYLE: Style = {
  stroke: { color: toColor('#1e2430'), width: 2, dash: 'solid' },
  fill: null,
  opacity: 1,
  corners: 'round',
  sketch: 0,
};

/** The kinds whose corners follow the default style. */
const ROUNDABLE_KINDS: readonly ElementKind[] = ['rectangle', 'diamond'];

/**
 * The style that a new element of `kind` takes from the editor's default style (REQ-C12):
 * rectangles and diamonds keep its corners, and every other kind has sharp ones.
 */
export function styleForKind(defaults: Style, kind: ElementKind): Style {
  return ROUNDABLE_KINDS.includes(kind) ? defaults : { ...defaults, corners: 'sharp' };
}
