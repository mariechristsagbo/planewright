import { describe, expect, it } from 'vitest';

import { zoomToFit } from '../../../src/camera/fit.ts';
import { DEFAULT_COMMANDS } from '../../../src/commands/defaults.ts';
import { createCommandRegistry } from '../../../src/commands/registry.ts';
import type { CommandTarget } from '../../../src/commands/registry.ts';
import { contentBounds } from '../../../src/geometry/world-bounds.ts';
import type { History } from '../../../src/history/history.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { sceneOf, shapeElement } from '../../support/elements.ts';
import { recorder } from '../../support/histories.ts';
import { changeSet } from '../../support/scene-state.ts';

// The default commands (docs/architecture/engine/interaction.md#commands-and-shortcuts) that the
// editor surface has so far: the Selection and Hand tools, Undo and Redo, and the zoom commands.

const registry = createCommandRegistry(DEFAULT_COMMANDS);
const box = shapeElement('rectangle', 420, 100, { id: 1, x: 340, y: 300 });

type MutableTarget = { -readonly [K in keyof CommandTarget]: CommandTarget[K] };

function target(scene: SceneStore = sceneOf(), history?: History): MutableTarget {
  const self: MutableTarget = {
    tool: 'selection',
    camera: { x: 200, y: 200, zoom: 1 },
    viewport: { width: 1280, height: 720, pixelRatio: 1 },
    scene,
    history: history ?? recorder(scene).history,
    setTool: (tool) => {
      self.tool = tool;
    },
    setCamera: (camera) => {
      self.camera = camera;
    },
    select: () => {
      throw new Error('Only the selection commands select.');
    },
    cancelGesture: () => false,
  };
  return self;
}

describe('the tool commands', () => {
  it('REQ-C14 give each tool a single-key shortcut', () => {
    const tools = registry.commands.filter((command) => command.tool !== undefined);
    expect(tools.map(({ id, tool, label }) => [id, tool, label])).toEqual([
      ['tool.hand', 'hand', 'Hand'],
      ['tool.selection', 'selection', 'Selection'],
    ]);
    expect(registry.get('tool.hand').shortcuts).toEqual([{ key: 'h' }]);
    expect(registry.get('tool.selection').shortcuts).toEqual([
      { key: 'v' },
      { key: 'Digit1', physical: true },
    ]);
  });

  it('choose their tool and are always enabled', () => {
    const view = target();
    expect(registry.run('tool.hand', view)).toBe('done');
    expect(view.tool).toBe('hand');
    expect(registry.run('tool.selection', view)).toBe('done');
    expect(view.tool).toBe('selection');
  });
});

describe('Undo and Redo', () => {
  it('REQ-H04 are disabled while the history is empty', () => {
    const view = target();
    expect(registry.run('history.undo', view)).toBe('disabled');
    expect(registry.run('history.redo', view)).toBe('disabled');
  });

  it('undo and redo the history’s entries once it has some', () => {
    const scene = sceneOf(box);
    const { history, commit } = recorder(scene);
    commit(changeSet([{ type: 'update', id: box.id, before: { x: 340 }, after: { x: 350 } }]));
    const view = target(scene, history);
    expect(registry.get('history.undo').isEnabled(view)).toBe(true);
    expect(registry.run('history.undo', view)).toBe('done');
    expect(scene.get(box.id)?.x).toBe(340);
    expect(registry.run('history.undo', view)).toBe('disabled');
    expect(registry.run('history.redo', view)).toBe('done');
    expect(scene.get(box.id)?.x).toBe(350);
  });
});

describe('the zoom commands', () => {
  const near = (camera: CommandTarget['camera'], x: number, y: number, zoom: number) => {
    expect(camera.x).toBeCloseTo(x, 1);
    expect(camera.y).toBeCloseTo(y, 1);
    expect(camera.zoom).toBeCloseTo(zoom, 9);
  };

  it('REQ-V02 zoom in, out twice and reset about the viewport centre', () => {
    const view = target();
    registry.run('view.zoom-in', view);
    near(view.camera, 258.2, 232.7, 1.1);
    registry.run('view.zoom-out', view);
    registry.run('view.zoom-out', view);
    near(view.camera, 128.9, 160, 0.9);
    registry.run('view.zoom-reset', view);
    near(view.camera, 200, 200, 1);
  });

  it('REQ-V09 zoom to fit centres the content and leaves an empty document alone', () => {
    const empty = target();
    expect(registry.run('view.zoom-to-fit', empty)).toBe('done');
    expect(empty.camera).toEqual({ x: 200, y: 200, zoom: 1 });
    const scene = sceneOf(box);
    const view = target(scene);
    registry.run('view.zoom-to-fit', view);
    const viewport = view.viewport;
    expect(view.camera).toEqual(
      zoomToFit({ x: 200, y: 200, zoom: 1 }, contentBounds(scene.ordered()), viewport),
    );
    expect(view.camera.x).toBeCloseTo(-90, 0);
  });
});
