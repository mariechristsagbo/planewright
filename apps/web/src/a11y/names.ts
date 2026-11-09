import type { ElementKind } from '@planewright/engine';

// How the interface names element kinds and counts, in the list and in announcements (REQ-Y05).

export const KIND_NAMES: Readonly<Record<ElementKind, string>> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  line: 'Line',
  freehand: 'Freehand stroke',
  text: 'Text',
  arrow: 'Arrow',
  note: 'Note',
  image: 'Image',
  frame: 'Frame',
};

/** A kind's name, or none for a value that is no kind. */
export const kindName = (kind: string): string | undefined =>
  Object.hasOwn(KIND_NAMES, kind) ? KIND_NAMES[kind as ElementKind] : undefined;
