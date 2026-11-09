import { describe, expect, it } from 'vitest';

import { DEFAULT_COMMANDS } from '../../../src/commands/defaults.ts';
import { createCommandRegistry } from '../../../src/commands/registry.ts';
import type { CommandTarget } from '../../../src/commands/registry.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { ToolId } from '../../../src/tools/tool.ts';
import { recorder } from '../../support/histories.ts';
import { keyEvent } from '../../support/inputs.ts';
import { ELLIPSE, TEXT, selectionDocument } from '../../support/selection-scene.ts';
import { sceneOf } from '../../support/elements.ts';

// Enter on the canvas (docs/architecture/engine/quality.md#accessibility): with a creation tool it
// creates the tool's default element at the centre of the viewport, and with the Selection tool it
// edits a lone selected text, so that no element kind needs a pointer (REQ-C04, REQ-Y05).

const registry = createCommandRegistry(DEFAULT_COMMANDS);
const ENTER = keyEvent('key-down', 'Enter', 'Enter');

/** A target over the selection fixture that records what Enter asks of it. */
function target(tool: ToolId, selection: readonly ElementId[] = [], open = false) {
  const asked: string[] = [];
  const scene = sceneOf(...selectionDocument().elements.values());
  const { history } = recorder(scene);
  const self: CommandTarget = {
    tool,
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1280, height: 720, pixelRatio: 1 },
    scene,
    history: { ...history, canUndo: false, canRedo: false, inTransaction: open },
    setTool: () => {
      throw new Error('Enter chooses no tool.');
    },
    toolLock: false,
    setToolLock: () => {
      throw new Error('Enter changes no tool lock.');
    },
    setCamera: () => {
      throw new Error('Enter moves no camera.');
    },
    select: () => {
      throw new Error('Enter selects nothing itself.');
    },
    cancelGesture: () => {
      asked.push('cancel');
      return false;
    },
    selection,
    newId: () => {
      throw new Error('Enter makes no identifier itself.');
    },
    keyPress: 0,
    edit: () => {
      throw new Error('Enter edits nothing itself.');
    },
    tapCentre: () => {
      asked.push('tap');
    },
    editText: (id) => {
      asked.push(`edit ${id}`);
    },
  };
  return { target: self, asked };
}

describe('Enter on the canvas', () => {
  it('REQ-Y05 is the Enter key, named for what it does', () => {
    const command = registry.forKey(ENTER);
    expect([command?.id, command?.label, command?.shortcuts, command?.tool]).toEqual([
      'canvas.enter',
      'Create at the centre, or edit the selected text',
      [{ key: 'enter' }],
      undefined,
    ]);
  });

  it('REQ-C04 REQ-Y05 taps the centre with each creation tool, after cancelling any gesture', () => {
    for (const tool of ['rectangle', 'ellipse', 'diamond', 'line', 'freehand', 'text'] as const) {
      const { target: view, asked } = target(tool);
      expect(registry.run('canvas.enter', view)).toBe('done');
      expect(asked).toEqual(['cancel', 'tap']);
    }
  });

  it('REQ-C10 REQ-Y05 edits a lone selected text with the Selection tool', () => {
    const { target: view, asked } = target('selection', [TEXT]);
    expect(registry.run('canvas.enter', view)).toBe('done');
    expect(asked).toEqual([`edit ${TEXT}`]);
  });

  it('REQ-Y05 does nothing without a lone selected text, with the Hand tool, or while a transaction is open', () => {
    const cases = [
      target('selection'),
      target('selection', [ELLIPSE]),
      target('selection', [TEXT, ELLIPSE]),
      target('hand', [TEXT]),
      target('rectangle', [], true),
      target('selection', [TEXT], true),
    ];
    for (const { target: view, asked } of cases) {
      expect(registry.run('canvas.enter', view)).toBe('disabled');
      expect(asked).toEqual([]);
    }
  });
});
