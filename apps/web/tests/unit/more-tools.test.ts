import type { EditorCommand, ToolId } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { MORE, dockCommands, moreCommands, moreFace } from '../../src/shell/more-tools.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The phone's dock and More as data (ADR 0012, decision 2; the v0.2 plan's S8, issue #73's D3):
// the dock is the registry's tools but Hand and Diamond, then More; More holds Hand, Diamond and
// Tool lock; both follow the registry and leave out what it lacks; More shows the active tool's
// glyph, pressed, while it holds that tool, whatever tool lock is.

const { commands } = surfaceHarness().editor;
const labels = (list: readonly EditorCommand[]): string[] => list.map(({ label }) => label);

const TOOLS: readonly ToolId[] = [
  'hand',
  'selection',
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'freehand',
  'text',
];

describe('the dock and More', () => {
  it('D2 the dock is the registry’s tools without Hand and Diamond, in the registry’s order, then More', () => {
    expect([...labels(dockCommands(commands)), MORE]).toEqual([
      'Selection',
      'Rectangle',
      'Ellipse',
      'Line',
      'Freehand',
      'Text',
      'more',
    ]);
  });

  it('D3 More holds Hand, Diamond and Tool lock, in the registry’s order', () => {
    expect(labels(moreCommands(commands))).toEqual(['Hand', 'Diamond', 'Tool lock']);
  });

  it('D3 both follow the registry’s order and leave out a command that it lacks, never inventing one', () => {
    const reversed = [...commands].reverse();
    expect(labels(dockCommands(reversed))).toEqual([
      'Text',
      'Freehand',
      'Line',
      'Ellipse',
      'Rectangle',
      'Selection',
    ]);
    expect(labels(moreCommands(reversed))).toEqual(['Tool lock', 'Diamond', 'Hand']);
    const without = commands.filter(({ id }) => id !== 'tool.diamond' && id !== 'tool.line');
    expect(labels(moreCommands(without))).toEqual(['Hand', 'Tool lock']);
    expect(labels(dockCommands(without))).toEqual([
      'Selection',
      'Rectangle',
      'Ellipse',
      'Freehand',
      'Text',
    ]);
    expect(moreCommands([])).toEqual([]);
  });

  it.each(TOOLS)(
    'A4 More shows the hand’s or the diamond’s glyph, pressed, only while that tool is active, here %s, with tool lock off or on',
    (tool) => {
      const held = tool === 'hand' || tool === 'diamond';
      for (const toolLock of [false, true]) {
        const view = { tool, toolLock };
        expect(moreFace(view)).toEqual(
          held ? { glyph: tool, pressed: true } : { glyph: 'more', pressed: false },
        );
      }
    },
  );
});
