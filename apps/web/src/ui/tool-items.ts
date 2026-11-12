import type { EditorCommand, EditorView, ToolId } from '@planewright/engine';

import type { IconName } from '../shell/glyphs.ts';

// The tool bar's buttons as data (ADR 0012, decision 3): each registry tool and tool lock with its
// glyph, its note and whether it shows as pressed, for the palette, the phone's dock and More.

/** What each tool does, after its shortcut in the button's description. */
const NOTES: Readonly<Record<ToolId, string>> = {
  hand: 'Drag to pan the canvas.',
  selection: 'Selects, moves, resizes and rotates the drawn elements.',
  rectangle: 'Drag to draw a rectangle; a tap draws a 100 by 100 one.',
  ellipse: 'Drag to draw an ellipse; a tap draws a 100 by 100 one.',
  diamond: 'Drag to draw a diamond; a tap draws a 100 by 100 one.',
  line: 'Drag to draw a line; a tap draws a horizontal line 100 long.',
  freehand: 'Drag to draw a freehand stroke; a tap draws a dot. The tool stays active.',
  text: 'Tap to place a text and type it; Escape or a tap elsewhere ends it.',
};

const LOCK_NOTE =
  'Keeps the rectangle, ellipse, diamond and line tools active after drawing, with nothing selected.';

/** Each tool's original glyph (ADR 0012, decision 3), so that every registry tool has one. */
export const TOOL_GLYPHS: Readonly<Record<ToolId, IconName>> = {
  hand: 'hand',
  selection: 'selection',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  line: 'line',
  freehand: 'freehand',
  text: 'text',
};

/** The palette's groups, which hairlines split: moving the view or selecting, then drawing. */
const TOOL_GROUPS: Readonly<Record<ToolId, 'view' | 'draw'>> = {
  hand: 'view',
  selection: 'view',
  rectangle: 'draw',
  ellipse: 'draw',
  diamond: 'draw',
  line: 'draw',
  freehand: 'draw',
  text: 'draw',
};

/**
 * A tool bar button: a tool, pressed while it is active, or tool lock, pressed while it is on and
 * showing a padlock that is closed while it is on and open otherwise.
 */
export interface ToolItem {
  readonly command: EditorCommand;
  readonly pressed: boolean;
  readonly note: string;
  readonly glyph: IconName;
  readonly group: 'view' | 'draw' | 'lock';
}

/** What the tool bar shows of the view: the active tool and tool lock, which a camera step keeps. */
export type ToolState = Pick<EditorView, 'tool' | 'toolLock'>;

/** The buttons of the given commands in their order: the tools, then tool lock, if given. */
export const itemsOf = (commands: readonly EditorCommand[], state: ToolState): ToolItem[] =>
  commands.flatMap((command): ToolItem[] => {
    const { tool } = command;
    if (tool !== undefined) {
      const glyph = TOOL_GLYPHS[tool];
      return [
        {
          command,
          pressed: state.tool === tool,
          note: NOTES[tool],
          glyph,
          group: TOOL_GROUPS[tool],
        },
      ];
    }
    if (command.id !== 'tool.lock') return [];
    const glyph = state.toolLock ? 'lock-closed' : 'lock-open';
    return [{ command, pressed: state.toolLock, note: LOCK_NOTE, glyph, group: 'lock' }];
  });
