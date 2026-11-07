import type { DocumentState } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import { SOLID, lineElement, shapeElement, testId, textElement } from './elements.ts';
import { color } from './scene-state.ts';

// A fixture document for the selection tests (ENG-09). At the editor's starting camera, at the
// origin and zoom 1, a scene point is the screen point, so presses are written in scene units.

/** A filled rectangle over x 100 to 300 and y 100 to 200. */
export const RECTANGLE = testId(1);
/** A filled ellipse over x 400 to 500 and y 100 to 200. */
export const ELLIPSE = testId(2);
/** A horizontal two-point line from (100, 400) to (300, 400). */
export const LINE = testId(3);
/** A text over x 400 to 520 and y 400 to 430. */
export const TEXT = testId(4);
/** A filled 20 × 20 square at (600, 100), too small on screen for side handles. */
export const SMALL = testId(5);

/** A document that holds the elements, on a white canvas, without groups. */
export function documentOf(...elements: readonly Element[]): DocumentState {
  return {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(),
    canvas: { background: color('#ffffff') },
    rev: 0,
  };
}

/** The fixture's elements, in drawing order. */
export function selectionElements(): readonly Element[] {
  const filled = { style: { fill: SOLID } };
  return [
    shapeElement('rectangle', 200, 100, { id: 1, order: 'a', x: 100, y: 100, ...filled }),
    shapeElement('ellipse', 100, 100, { id: 2, order: 'b', x: 400, y: 100, ...filled }),
    lineElement(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      { id: 3, order: 'c', x: 100, y: 400 },
    ),
    textElement(120, 30, { id: 4, order: 'd', x: 400, y: 400 }),
    shapeElement('rectangle', 20, 20, { id: 5, order: 'e', x: 600, y: 100, ...filled }),
  ];
}

export const selectionDocument = (): DocumentState => documentOf(...selectionElements());
