import { createEditor, openEditor } from '../../src/editor/editor.ts';
import type { Editor, EditorView } from '../../src/editor/editor.ts';
import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { InputEvent } from '../../src/input/events.ts';
import type { DocumentState } from '../../src/model/document.ts';
import {
  createCountingIds,
  createFixedAdvanceMeasurer,
  createManualClock,
  createQueueScheduler,
} from './fakes.ts';
import type { QueueScheduler } from './fakes.ts';

// An editor over fake ports on a 1280 × 720 viewport, driven by scripted input sessions.

export interface EditorHarness {
  readonly editor: Editor;
  readonly scheduler: QueueScheduler;
  /** Every view the editor published since the harness was made. */
  readonly views: EditorView[];
  /** Feeds the events in order. */
  readonly feed: (...events: readonly InputEvent[]) => void;
  /** Runs the queued animation frames and returns the frames handed over since the last call. */
  readonly next: () => RenderFrame[];
}

export const VIEWPORT = { width: 1280, height: 720, pixelRatio: 1 };

/**
 * An editor whose listener has drawn its first full frame, so nothing is dirty: over an empty
 * document, or over a fixture document opened without an undo step.
 */
export function editorHarness(document?: DocumentState): EditorHarness {
  const clock = createManualClock();
  const scheduler = createQueueScheduler(clock);
  const ports = { clock, scheduler, ids: createCountingIds(), text: createFixedAdvanceMeasurer() };
  const editor = document === undefined ? createEditor(ports) : openEditor(ports, document);
  editor.resize(VIEWPORT);
  const frames: RenderFrame[] = [];
  editor.onFrame((frame) => frames.push(frame));
  scheduler.frame();
  frames.length = 0;
  const views: EditorView[] = [];
  editor.subscribe((view) => views.push(view));
  return {
    editor,
    scheduler,
    views,
    feed: (...events) => {
      for (const event of events) editor.input(event);
    },
    next: () => {
      scheduler.frame();
      return frames.splice(0);
    },
  };
}
