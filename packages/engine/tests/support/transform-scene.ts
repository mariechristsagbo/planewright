import { localBox } from '../../src/geometry/world-bounds.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { SOLID, shapeElement } from './elements.ts';
import type { EditorHarness } from './editors.ts';
import { down, move, up } from './inputs.ts';

// Fixtures and input for the transform tests through the editor (ENG-10). At the editor's starting
// camera a scene point is the screen point, so boxes and drags are written in scene units.

/** A filled rectangle over a box [x, y, width, height], so that a press inside it hits it. */
export const filledBox = (id: number, [x = 0, y = 0, width = 0, height = 0]: readonly number[]) =>
  shapeElement('rectangle', width, height, {
    id,
    order: `a${String(id)}`,
    x,
    y,
    style: { fill: SOLID },
  });

/** An element's box as [x, y, width, height]. */
export function boxOf(element: Element): number[] {
  const { x, y, width, height } = localBox(element);
  return [x, y, width, height];
}

/**
 * Reads elements as a renderer is handed them: every frame that redraws the scene layer lists the
 * visible elements, so the last such frame shows the document's current state.
 */
export function sceneWatcher({ next }: Pick<EditorHarness, 'next'>): (id: ElementId) => Element {
  let shown: readonly Element[] = [];
  return (id) => {
    const scene = next().findLast((frame) => frame.scene !== undefined)?.scene;
    if (scene !== undefined) shown = scene.elements;
    const element = shown.find((candidate) => candidate.id === id);
    if (element === undefined) throw new Error(`No frame shows ${id}.`);
    return element;
  };
}

/** A press, a move through a point past the drag threshold, a move to the end, and the release. */
export function dragFrom(
  pointer: PointerKind,
  [x0 = 0, y0 = 0, x1 = 0, y1 = 0]: readonly number[],
  keys: { readonly shift?: boolean; readonly alt?: boolean } = {},
) {
  const options = { pointer, time: 20_000, modifiers: keys };
  const past = { x: x0 + (x1 > x0 ? 10 : -10), y: y0 + (y1 >= y0 ? 10 : -10) };
  return {
    start: [down(x0, y0, options), move(past.x, past.y, options)],
    to: move(x1, y1, options),
    end: up(x1, y1, options),
  };
}
