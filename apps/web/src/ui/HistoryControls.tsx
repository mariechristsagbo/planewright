import { Fragment } from 'react';

import { useEditorView, useSurface } from '../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence } from './shortcuts.ts';

/** Undo and Redo, enabled only while the history has a step to undo or redo (REQ-V10, REQ-H04). */
export function HistoryControls() {
  const { editor, platform } = useSurface();
  const { canUndo, canRedo } = useEditorView();
  const commands = editor.commands.filter(
    ({ id }) => id === 'history.undo' || id === 'history.redo',
  );
  return (
    <div role="group" aria-label="History" className="history-controls">
      {commands.map((command) => (
        <Fragment key={command.id}>
          <button
            type="button"
            disabled={!(command.id === 'history.undo' ? canUndo : canRedo)}
            aria-keyshortcuts={ariaKeyShortcuts(command.shortcuts, platform)}
            aria-describedby={`${command.id}-description`}
            onClick={() => {
              editor.run(command.id);
            }}
          >
            {command.label}
          </button>
          <span id={`${command.id}-description`} className="visually-hidden">
            {shortcutSentence(command.shortcuts, platform)} Nothing changes the drawing yet, so
            there is nothing to undo or redo.
          </span>
        </Fragment>
      ))}
    </div>
  );
}
