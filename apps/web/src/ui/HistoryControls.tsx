import { Fragment } from 'react';

import { useEditorView, useSurface } from '../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence } from './shortcuts.ts';

/** What each control does, after its shortcuts in its description. */
const NOTES: Readonly<Record<string, string>> = {
  'history.undo': 'Undoes the last change to the drawing.',
  'history.redo': 'Redoes the last change that was undone.',
};

/**
 * Undo and Redo, enabled only while the history has a step to undo or redo (REQ-H02); the camera
 * never enters it (REQ-V10, REQ-H04).
 */
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
            {shortcutSentence(command.shortcuts, platform)} {NOTES[command.id]}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
