import type {
  Element,
  ElementKind,
  FreehandElement,
  LineElement,
  ShapeElement,
  TextElement,
} from '@planewright/engine';

import { surfaceHarness } from './surface.tsx';

// Elements of each kind that P0 draws, for the unit tests that read an element's figures: each is
// drawn in one editor by its tool with Enter at the centre of an 800 × 600 canvas, (400, 300), as a
// person draws it from the keyboard, so that their identifiers differ, and the tests change their
// geometry by spreading them.

export interface DrawnKinds {
  readonly rectangle: ShapeElement;
  readonly ellipse: ShapeElement;
  readonly diamond: ShapeElement;
  readonly line: LineElement;
  readonly freehand: FreehandElement;
  readonly text: TextElement;
}

const TOOLS = [
  'tool.rectangle',
  'tool.ellipse',
  'tool.diamond',
  'tool.line',
  'tool.freehand',
  'tool.text',
] as const;

/** The drawn element of a kind, narrowed to its type, or a failed test. */
function ofKind<K extends ElementKind>(
  elements: readonly Element[],
  kind: K,
): Element & { readonly kind: K } {
  const element = elements.find(
    (each): each is Element & { readonly kind: K } => each.kind === kind,
  );
  if (element === undefined) throw new Error(`No ${kind} was drawn.`);
  return element;
}

/** One element of each P0 kind, the text holding "Plan". */
export function drawnKinds(): DrawnKinds {
  const { editor } = surfaceHarness();
  editor.resize({ width: 800, height: 600, pixelRatio: 1 });
  for (const tool of TOOLS) {
    editor.run(tool);
    editor.run('canvas.enter');
  }
  editor.editText({ type: 'value', text: 'Plan' });
  editor.editText({ type: 'commit' });
  const { elements } = editor.view;
  return {
    rectangle: ofKind(elements, 'rectangle'),
    ellipse: ofKind(elements, 'ellipse'),
    diamond: ofKind(elements, 'diamond'),
    line: ofKind(elements, 'line'),
    freehand: ofKind(elements, 'freehand'),
    text: ofKind(elements, 'text'),
  };
}
