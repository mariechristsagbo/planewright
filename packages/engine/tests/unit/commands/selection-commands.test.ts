import { describe, expect, it } from 'vitest';

import { DEFAULT_COMMANDS } from '../../../src/commands/defaults.ts';
import { createCommandRegistry } from '../../../src/commands/registry.ts';
import type { CommandTarget } from '../../../src/commands/registry.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { ToolId } from '../../../src/tools/tool.ts';
import { recorder } from '../../support/histories.ts';
import { keyEvent } from '../../support/inputs.ts';
import { fixtureId, fixtureStore } from '../../support/stores.ts';

// Select all and Escape (docs/architecture/engine/interaction.md#commands-and-shortcuts), over the
// shared fixture: a rectangle, a locked ellipse, a diamond, a line, a freehand stroke and a text,
// then an arrow, a note, an image and a frame, the kinds that have no geometry in P0.

const registry = createCommandRegistry(DEFAULT_COMMANDS);

/** A target over the fixture that records what it is asked; `open` says if a gesture is open. */
function target(open: boolean) {
  const asked = { selections: [] as (readonly ElementId[])[], tools: [] as ToolId[], cancels: 0 };
  const scene = fixtureStore();
  const self: CommandTarget = {
    tool: 'hand',
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1280, height: 720, pixelRatio: 1 },
    scene,
    history: recorder(scene).history,
    setTool: (tool) => {
      asked.tools.push(tool);
    },
    toolLock: false,
    setToolLock: () => {
      throw new Error('No selection command changes tool lock.');
    },
    setCamera: () => {
      throw new Error('No selection command moves the camera.');
    },
    select: (ids) => {
      asked.selections.push(ids);
    },
    cancelGesture: () => {
      asked.cancels += 1;
      return open;
    },
    selection: [],
    newId: () => {
      throw new Error('No command here makes elements.');
    },
    keyPress: 0,
    edit: () => {
      throw new Error('No command here edits.');
    },
  };
  return { target: self, asked };
}

const commandFor = (key: string, code: string, modifiers = {}) =>
  registry.forKey(keyEvent('key-down', key, code, modifiers))?.id;

describe('Select all', () => {
  it('REQ-S09 selects every element of a kind that has a geometry, in drawing order', () => {
    const { target: all, asked } = target(false);
    expect(registry.run('selection.select-all', all)).toBe('done');
    expect(asked).toEqual({
      selections: [[0, 1, 2, 3, 4, 5].map(fixtureId)],
      tools: [],
      cancels: 0,
    });
  });

  it('REQ-S09 is Mod+A, by the produced letter or, on a non-Latin layout, the physical key', () => {
    expect(commandFor('a', 'KeyA', { mod: true })).toBe('selection.select-all');
    expect(commandFor('ф', 'KeyF', { mod: true })).toBeUndefined();
    expect(commandFor('ф', 'KeyA', { mod: true })).toBe('selection.select-all');
    expect(commandFor('a', 'KeyA')).toBeUndefined();
  });
});

describe('Escape', () => {
  it('REQ-S10 clears the selection and returns to the Selection tool when no gesture is open', () => {
    const { target: idle, asked } = target(false);
    expect(registry.run('selection.cancel', idle)).toBe('done');
    expect(asked).toEqual({ selections: [[]], tools: ['selection'], cancels: 1 });
  });

  it('cancels an open gesture and leaves the selection and the tool as they are', () => {
    const { target: busy, asked } = target(true);
    registry.run('selection.cancel', busy);
    expect(asked).toEqual({ selections: [], tools: [], cancels: 1 });
  });

  it('is the Escape key without modifiers', () => {
    expect(commandFor('Escape', 'Escape')).toBe('selection.cancel');
    expect(commandFor('Escape', 'Escape', { shift: true })).toBeUndefined();
  });
});
