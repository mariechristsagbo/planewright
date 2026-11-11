import type { CommandId } from '@planewright/engine';
import { Fragment, useCallback, useSyncExternalStore } from 'react';

import { useSurface } from '../editor/surface.ts';
import type { IconName } from '../shell/glyphs.ts';
import { Icon } from '../shell/icons.tsx';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from './shortcuts.ts';

/**
 * The zoom commands in the order the controls show them, what each does and the glyph it shows;
 * Reset zoom shows the zoom instead.
 */
const ZOOMS: readonly (readonly [CommandId, string, IconName | null])[] = [
  ['view.zoom-out', 'Zooms out one step about the centre of the canvas.', 'zoom-out'],
  ['view.zoom-reset', 'Zooms to 100% about the centre of the canvas.', null],
  ['view.zoom-in', 'Zooms in one step about the centre of the canvas.', 'zoom-in'],
  ['view.zoom-to-fit', 'Zooms and moves the view to show the whole drawing.', 'zoom-fit'],
];

/**
 * The zoom in whole per cent. It renders again only when the zoom changes, not at each pan step,
 * which publishes a new view with the same zoom (ADR 0012, decision 14).
 */
function useZoomPercent(): number {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => Math.round(editor.view.camera.zoom * 100));
}

/**
 * Zoom out, Reset zoom, Zoom in and Zoom to fit, the last stops of the tab order
 * (docs/architecture/engine/quality.md#accessibility). They read the command registry, and each
 * shows the first of its shortcuts, since the others are the same key on other layouts. Reset
 * zoom shows the zoom and says it in its name, such as "Reset zoom, 100%" (ADR 0012); the others
 * show their original glyphs and are named by the registry's labels, which their tooltips repeat
 * with the keys. The camera never animates, so each press shows its new view at once (REQ-Y06).
 */
export function ZoomControls() {
  const { editor, platform } = useSurface();
  const percent = useZoomPercent();
  return (
    <div role="group" aria-label="Zoom" className="zoom-controls">
      {ZOOMS.flatMap(([id, note, glyph]) => {
        const command = editor.commands.find((each) => each.id === id);
        if (command === undefined) return [];
        const shortcuts = command.shortcuts.slice(0, 1);
        return [
          <Fragment key={id}>
            <button
              type="button"
              className={glyph === null ? undefined : 'glyph-button'}
              aria-label={glyph === null ? `${command.label}, ${String(percent)}%` : command.label}
              aria-keyshortcuts={ariaKeyShortcuts(shortcuts, platform)}
              aria-describedby={`${id}-description`}
              data-chrome-tip={command.label}
              data-chrome-keys={shortcutText(shortcuts, platform)}
              onClick={() => {
                editor.run(id);
              }}
            >
              {glyph === null ? `${String(percent)}%` : <Icon name={glyph} />}
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
