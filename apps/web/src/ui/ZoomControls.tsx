import type { CommandId } from '@planewright/engine';
import { Fragment } from 'react';

import { useSurface } from '../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence } from './shortcuts.ts';

/** The zoom commands in the order the controls show them, and what each does. */
const ZOOMS: readonly (readonly [CommandId, string])[] = [
  ['view.zoom-out', 'Zooms out one step about the centre of the canvas.'],
  ['view.zoom-reset', 'Zooms to 100% about the centre of the canvas.'],
  ['view.zoom-in', 'Zooms in one step about the centre of the canvas.'],
  ['view.zoom-to-fit', 'Zooms and moves the view to show the whole drawing.'],
];

/**
 * Zoom out, Reset zoom, Zoom in and Zoom to fit, the last stops of the tab order
 * (docs/architecture/engine/quality.md#accessibility). They read the command registry, and each
 * shows the first of its shortcuts, since the others are the same key on other layouts. The
 * camera never animates, so each press shows its new view at once (REQ-Y06).
 */
export function ZoomControls() {
  const { editor, platform } = useSurface();
  return (
    <div role="group" aria-label="Zoom" className="zoom-controls">
      {ZOOMS.flatMap(([id, note]) => {
        const command = editor.commands.find((each) => each.id === id);
        if (command === undefined) return [];
        const shortcuts = command.shortcuts.slice(0, 1);
        return [
          <Fragment key={id}>
            <button
              type="button"
              aria-keyshortcuts={ariaKeyShortcuts(shortcuts, platform)}
              aria-describedby={`${id}-description`}
              onClick={() => {
                editor.run(id);
              }}
            >
              {command.label}
            </button>
            <span id={`${id}-description`} className="visually-hidden">
              {shortcutSentence(shortcuts, platform)} {note}
            </span>
          </Fragment>,
        ];
      })}
    </div>
  );
}
