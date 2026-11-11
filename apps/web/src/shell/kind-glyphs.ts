import type { ElementKind } from '@planewright/engine';

import type { IconName } from './glyphs.ts';

/**
 * Each kind's original glyph (ADR 0012, decision 3): the tool's that draws it, which the element
 * list's rows and the selection's heading show. The kinds that P0 does not draw, which the view
 * never lists, would show the list's own glyph.
 */
export const KIND_GLYPHS: Readonly<Record<ElementKind, IconName>> = {
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  line: 'line',
  freehand: 'freehand',
  text: 'text',
  arrow: 'elements',
  note: 'elements',
  image: 'elements',
  frame: 'elements',
};
