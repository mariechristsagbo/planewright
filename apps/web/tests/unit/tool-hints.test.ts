import type { ToolId } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { TOOL_HINTS, hintOf } from '../../src/shell/tool-hints.ts';
import { itemsOf } from '../../src/ui/tool-items.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The tool hints' words (ADR 0012, decision 3; the v0.2 plan's S10, issue #77's D4): one caption
// line per tool, Planewright's own words, kept by the shell as a constant per tool identifier, so
// that every registry tool has exactly one hint. This test holds its own copy of D4's words.

const D4: Readonly<Record<ToolId, string>> = {
  hand: 'Drag to pan the view',
  selection: 'Select, move, resize or rotate what is drawn',
  rectangle: 'Drag to draw a rectangle; tap for the default size',
  ellipse: 'Drag to draw an ellipse; tap for the default size',
  diamond: 'Drag to draw a diamond; tap for the default size',
  line: 'Drag to draw a line; tap for a horizontal one',
  freehand: 'Drag to draw a stroke; tap for a dot',
  text: 'Tap to place a text, then type it',
};

const { editor } = surfaceHarness();
const tools = editor.commands.flatMap(({ tool }) => (tool === undefined ? [] : [tool]));

describe('the tool hints', () => {
  it('A5 D4 name exactly the registry’s tools, each once', () => {
    expect(tools).toHaveLength(8);
    expect(Object.keys(TOOL_HINTS).sort()).toEqual([...tools].sort());
  });

  it('A5 D4 are D4’s words, each one line of at most 50 characters with no final full stop, all different', () => {
    expect(TOOL_HINTS).toEqual(D4);
    const words = Object.values(TOOL_HINTS);
    expect(words.filter((hint) => hint.length > 50 || /\n|\.$/u.test(hint))).toEqual([]);
    expect(new Set(words).size).toBe(words.length);
  });

  it('D4 say something other than each tool button’s description', () => {
    const notes = itemsOf(editor.commands, editor.view).map(({ note }) => note);
    expect(notes).toHaveLength(9);
    expect(
      Object.values(TOOL_HINTS).filter((hint) => notes.some((note) => note.includes(hint))),
    ).toEqual([]);
  });

  it('D4 hintOf gives the active tool’s entry', () => {
    expect(tools.map((tool) => hintOf(tool))).toEqual(tools.map((tool) => D4[tool]));
    expect(hintOf(editor.view.tool)).toBe(D4.selection);
  });
});
