import { createEditor } from '../../src/editor/editor.ts';
import type { Editor } from '../../src/editor/editor.ts';
import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { TextMeasurer } from '../../src/geometry/text-measurer.ts';
import type { InputEvent } from '../../src/input/events.ts';
import type { Element } from '../../src/model/elements.ts';
import type { DocumentRepository, StoredDocument } from '../../src/persistence/repository.ts';
import type { IdSource } from '../../src/ports/ports.ts';
import { settle } from './autosave.ts';
import { VIEWPORT } from './editors.ts';
import { createFixedAdvanceMeasurer, createManualClock, createQueueScheduler } from './fakes.ts';
import type { QueueScheduler } from './fakes.ts';

// Editors over fake ports and a repository, as the web app opens them: each its own clock,
// timers and identifiers, so that two editors can share one repository as two tabs share storage.

export interface SavingEditor {
  readonly editor: Editor;
  readonly scheduler: QueueScheduler;
  readonly feed: (...events: readonly InputEvent[]) => void;
  /** Moves the clock, running due timers, then lets save results arrive and be published. */
  readonly advance: (ms: number) => Promise<void>;
  /** The elements the last full scene frame drew, in drawing order. */
  readonly shown: () => readonly Element[];
}

/** Identifiers that start with a letter of their own, then count up. */
export function letteredIds(letter: string): IdSource {
  let count = 0;
  return { next: () => `${letter}${String((count += 1)).padStart(21, '0')}` };
}

export function savingEditor(
  repository: DocumentRepository | undefined,
  stored?: StoredDocument,
  letter = 'E',
  text: TextMeasurer = createFixedAdvanceMeasurer(),
): SavingEditor {
  const clock = createManualClock();
  const scheduler = createQueueScheduler(clock);
  const ports = {
    clock,
    scheduler,
    ids: letteredIds(letter),
    text,
    ...(repository === undefined ? {} : { repository }),
  };
  const editor = createEditor(ports, stored);
  editor.resize(VIEWPORT);
  const frames: RenderFrame[] = [];
  editor.onFrame((frame) => frames.push(frame));
  let shown: readonly Element[] = [];
  return {
    editor,
    scheduler,
    feed: (...events) => {
      for (const event of events) editor.input(event);
    },
    advance: async (ms) => {
      scheduler.advance(ms);
      await settle();
    },
    shown: () => {
      scheduler.frame();
      const scene = frames.splice(0).findLast((frame) => frame.scene !== undefined)?.scene;
      if (scene !== undefined) shown = scene.elements;
      return shown;
    },
  };
}

/** What the repository loads, which must be a stored document. */
export async function loaded(repository: DocumentRepository): Promise<StoredDocument> {
  const result = await repository.load();
  if (result.type !== 'loaded') throw new Error(`The repository loaded ${result.type}.`);
  return result.stored;
}
