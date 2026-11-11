import type { CommandId } from '@planewright/engine';
import { Fragment } from 'react';

import { useSurface } from '../../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from '../../ui/shortcuts.ts';
import type { IconName } from '../glyphs.ts';
import { Icon } from '../icons.tsx';

// The selection's actions (ADR 0012, decisions 1 and 13; the v0.2 plan's S6): each runs an existing
// command through editor.run, which announces it as its keys do, and adds no capability.

/** Duplicate and Delete in their order, with their glyphs and classes; Delete in the error tone. */
const COMMANDS: readonly (readonly [CommandId, IconName, string])[] = [
  ['selection.duplicate', 'duplicate', 'selection-action'],
  ['selection.delete', 'delete', 'selection-action delete-action'],
];

/** Edit text's description; the button has no key of its own. */
const EDIT_TEXT_NOTE = 'Edits the text where it is drawn; Enter on the canvas does the same.';

/**
 * Duplicate and Delete, named, described and tipped from the registry as Undo and Redo are
 * (REQ-C14), then Edit text where canvas.enter would edit the selected text. Each shows its glyph
 * and its word, which names it (WCAG 2.5.3); in the phone's bar, which is too narrow for the words,
 * the word is visually hidden and still names it.
 */
export function SelectionActions({
  editsText,
  compact = false,
}: {
  readonly editsText: boolean;
  /** Whether the words are visually hidden, as in the phone's bar. */
  readonly compact?: boolean;
}) {
  const { editor, platform } = useSurface();
  const word = compact ? 'visually-hidden' : undefined;
  return (
    <div className="selection-actions">
      {COMMANDS.flatMap(([id, glyph, className]) => {
        const command = editor.commands.find((each) => each.id === id);
        if (command === undefined) return [];
        return [
          <Fragment key={id}>
            <button
              type="button"
              className={className}
              aria-keyshortcuts={ariaKeyShortcuts(command.shortcuts, platform)}
              aria-describedby={`${id}-description`}
              data-chrome-tip={command.label}
              data-chrome-keys={shortcutText(command.shortcuts, platform)}
              onClick={() => {
                editor.run(id);
              }}
            >
              <Icon name={glyph} size={compact ? 20 : 16} />
              <span className={word}>{command.label}</span>
            </button>
            <span id={`${id}-description`} className="visually-hidden">
              {shortcutSentence(command.shortcuts, platform)}
            </span>
          </Fragment>,
        ];
      })}
      {editsText ? (
        <>
          <button
            type="button"
            className="selection-action"
            aria-describedby="edit-text-description"
            data-chrome-tip="Edit text"
            onClick={() => {
              editor.run('canvas.enter');
            }}
          >
            <Icon name="edit-text" size={compact ? 20 : 16} />
            <span className={word}>Edit text</span>
          </button>
          <span id="edit-text-description" className="visually-hidden">
            {EDIT_TEXT_NOTE}
          </span>
        </>
      ) : null}
    </div>
  );
}
