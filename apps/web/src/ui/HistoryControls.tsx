import type { CommandId } from '@planewright/engine';
import { Fragment } from 'react';

import { useEditorView, useSurface } from '../editor/surface.ts';
import type { IconName } from '../shell/glyphs.ts';
import { Icon } from '../shell/icons.tsx';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from './shortcuts.ts';

/**
 * Undo and Redo in their order, with what each does, after its shortcuts in its description, and
 * its glyph.
 */
const CONTROLS: readonly (readonly [CommandId, string, IconName])[] = [
  ['history.undo', 'Undoes the last change to the drawing.', 'undo'],
  ['history.redo', 'Redoes the last change that was undone.', 'redo'],
];

/**
 * Undo and Redo, available only while the history has a step to undo or redo (REQ-H02); the camera
 * never enters it (REQ-V10, REQ-H04). An unavailable one is aria-disabled, not disabled, so that it
 * keeps the focus when it becomes unavailable instead of dropping it on the page (REQ-Y02). Each
 * shows its original glyph and is named by the registry's label (ADR 0012, decision 3), which its
 * tooltip repeats with its keys.
 */
export function HistoryControls() {
  const { editor, platform } = useSurface();
  const { canUndo, canRedo } = useEditorView();
  return (
    <div role="group" aria-label="History" className="history-controls">
      {CONTROLS.flatMap(([id, note, glyph]) => {
        const command = editor.commands.find((each) => each.id === id);
        if (command === undefined) return [];
        return [
          <Fragment key={id}>
            <button
              type="button"
              className="glyph-button"
              aria-label={command.label}
              aria-disabled={(id === 'history.undo' ? canUndo : canRedo) ? undefined : true}
              aria-keyshortcuts={ariaKeyShortcuts(command.shortcuts, platform)}
              aria-describedby={`${id}-description`}
              data-chrome-tip={command.label}
              data-chrome-keys={shortcutText(command.shortcuts, platform)}
              onClick={() => {
                // The command does nothing while it is unavailable.
                editor.run(id);
              }}
            >
              <Icon name={glyph} />
            </button>
            <span id={`${id}-description`} className="visually-hidden">
              {shortcutSentence(command.shortcuts, platform)} {note}
            </span>
          </Fragment>,
        ];
      })}
    </div>
  );
}
