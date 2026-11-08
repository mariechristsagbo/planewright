import type { Camera } from '../camera/camera.ts';
import { zoomToFit } from '../camera/fit.ts';
import { resetZoom, zoomIn, zoomOut } from '../camera/ladder.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import { geometryOf } from '../geometry/kinds.ts';
import { contentBounds } from '../geometry/world-bounds.ts';
import type { ToolId } from '../tools/tool.ts';
import type { KeyChord } from './chords.ts';
import { EDIT_COMMANDS } from './edit-commands.ts';
import type { Command, CommandId } from './registry.ts';

// The commands that the editor has so far
// (docs/architecture/engine/interaction.md#commands-and-shortcuts); the others join with the
// issues that give them behaviour.

const always = (): boolean => true;

/** Mod with a produced key, with or without Shift, wherever the layout puts it. */
const modWithEitherShift = (key: string): KeyChord[] => [
  { key, mod: true },
  { key, mod: true, shift: true },
];

const toolCommand = (tool: ToolId, label: string, shortcuts: readonly KeyChord[]): Command => ({
  id: `tool.${tool}`,
  label,
  shortcuts,
  tool,
  isEnabled: always,
  run: (target) => {
    target.setTool(tool);
  },
});

const cameraCommand = (
  id: CommandId,
  label: string,
  shortcuts: readonly KeyChord[],
  next: (camera: Camera, viewport: ViewportSize) => Camera,
): Command => ({
  id,
  label,
  shortcuts,
  isEnabled: always,
  run: (target) => {
    target.setCamera(next(target.camera, target.viewport));
  },
});

/** In tool bar order for the tools; digits follow that order (REQ-C14). */
export const DEFAULT_COMMANDS: readonly Command[] = [
  toolCommand('hand', 'Hand', [{ key: 'h' }]),
  toolCommand('selection', 'Selection', [{ key: 'v' }, { key: 'Digit1', physical: true }]),
  toolCommand('rectangle', 'Rectangle', [{ key: 'r' }, { key: 'Digit2', physical: true }]),
  toolCommand('ellipse', 'Ellipse', [{ key: 'o' }, { key: 'Digit3', physical: true }]),
  toolCommand('diamond', 'Diamond', [{ key: 'd' }, { key: 'Digit4', physical: true }]),
  toolCommand('line', 'Line', [{ key: 'l' }, { key: 'Digit5', physical: true }]),
  toolCommand('freehand', 'Freehand', [{ key: 'p' }, { key: 'Digit6', physical: true }]),
  {
    id: 'tool.lock',
    label: 'Tool lock',
    shortcuts: [{ key: 'q' }],
    isEnabled: always,
    // A toggle of the editor's state, not of the document, so never an undo step (REQ-H04).
    run: (target) => {
      target.setToolLock(!target.toolLock);
    },
  },
  {
    id: 'history.undo',
    label: 'Undo',
    shortcuts: [{ key: 'z', mod: true }],
    // Ignored while a gesture's transaction is open (REQ-H06).
    isEnabled: (target) => target.history.canUndo && !target.history.inTransaction,
    run: (target) => {
      target.history.undo();
    },
  },
  {
    id: 'history.redo',
    label: 'Redo',
    shortcuts: [
      { key: 'z', mod: true, shift: true },
      { key: 'y', mod: true },
    ],
    isEnabled: (target) => target.history.canRedo && !target.history.inTransaction,
    run: (target) => {
      target.history.redo();
    },
  },
  {
    id: 'selection.select-all',
    label: 'Select all',
    shortcuts: [{ key: 'a', mod: true }],
    isEnabled: always,
    // Selectable in P0: a kind that has a geometry, as hit testing and box selection read it;
    // locked elements are left out in P1 (REQ-S08).
    run: (target) => {
      const ids = target.scene
        .ordered()
        .flatMap((element) => (geometryOf(element) === undefined ? [] : [element.id]));
      target.select(ids);
    },
  },
  {
    id: 'selection.cancel',
    label: 'Cancel, clear selection',
    shortcuts: [{ key: 'escape' }],
    isEnabled: always,
    run: (target) => {
      if (target.cancelGesture()) return;
      target.select([]);
      target.setTool('selection');
    },
  },
  cameraCommand('view.zoom-in', 'Zoom in', ['=', '+'].flatMap(modWithEitherShift), zoomIn),
  cameraCommand('view.zoom-out', 'Zoom out', ['-', '−', '_'].flatMap(modWithEitherShift), zoomOut),
  cameraCommand(
    'view.zoom-reset',
    'Reset zoom',
    [{ key: 'Digit0', physical: true, mod: true }],
    resetZoom,
  ),
  {
    id: 'view.zoom-to-fit',
    label: 'Zoom to fit',
    shortcuts: [{ key: 'Digit1', physical: true, shift: true }],
    isEnabled: always,
    run: (target) => {
      const content = contentBounds(target.scene.ordered());
      target.setCamera(zoomToFit(target.camera, content, target.viewport));
    },
  },
  ...EDIT_COMMANDS,
];
