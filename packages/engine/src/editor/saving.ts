import type { CommandTarget } from '../commands/registry.ts';
import { createAutosave } from '../persistence/autosave.ts';
import type { Autosave } from '../persistence/autosave.ts';
import { newDocumentId } from '../persistence/repository.ts';
import type { DocumentRepository, StoredDocument } from '../persistence/repository.ts';
import { sameIds } from '../selection/selection.ts';
import type { EditorCore, EditorPorts } from './editor-core.ts';
import { replaceDocument, showSession } from './load.ts';
import { discardSession } from './text-session.ts';
import type { ViewPublisher } from './view.ts';

// Saving from the editor (docs/architecture/engine/persistence.md): autosave over the editor's
// scene, the session state read from its camera and selection, and the two answers to a stale
// refusal (REQ-P06).

/** The answer to another tab's newer save: load the newer version, or keep this one. */
export type StaleChoice = 'load' | 'keep';

export interface Saving {
  readonly saveNow: () => void;
  readonly resolveStale: (choice: StaleChoice) => Promise<void>;
  readonly dispose: () => void;
}

/** The editor's parts that saving reads, changes and publishes. */
export interface SavingParts {
  readonly core: EditorCore;
  readonly target: CommandTarget;
  readonly views: ViewPublisher;
  readonly publish: () => void;
}

const NOT_SAVING: Saving = {
  saveNow: () => undefined,
  resolveStale: () => Promise.resolve(),
  dispose: () => undefined,
};

/**
 * Loads the newer stored version as a reload would: whatever this editor had not saved is
 * dropped, gesture and text session included, and the stored document, camera and selection are
 * shown with the Selection tool and an empty history (REQ-P02, REQ-H03).
 */
function showStored(parts: SavingParts, autosave: Autosave, stored: StoredDocument): void {
  const { core, target } = parts;
  target.cancelGesture();
  const { transaction } = core;
  core.transaction = null;
  transaction?.cancel();
  discardSession(core);
  replaceDocument(core, stored.document);
  core.history.clear();
  target.setTool('selection');
  showSession(core, stored.session);
  autosave.reset(stored.id, stored.rev);
}

interface Watch {
  quiet: boolean;
  disposed: boolean;
}

function createAutosaveFor(
  ports: EditorPorts & { readonly repository: DocumentRepository },
  stored: StoredDocument | undefined,
  parts: SavingParts,
  watch: Watch,
): Autosave {
  const { core, publish } = parts;
  return createAutosave({
    id: stored?.id ?? newDocumentId(ports.ids),
    rev: stored?.rev ?? 0,
    store: core.scene,
    clock: ports.clock,
    scheduler: ports.scheduler,
    repository: ports.repository,
    session: () => ({ camera: core.loop.state().camera, selection: core.selection.get() }),
    onStatus: (status) => {
      core.saveStatus = status;
      // A save's result arrives outside any input, so the view is published for it; a change
      // during input is published by that input already.
      void Promise.resolve().then(() => {
        if (!watch.disposed) publish();
      });
    },
  });
}

/**
 * Saving for an editor with a repository: the stored document's identifier and revision, or a new
 * identifier at revision 0, and every camera or selection change the view shows.
 */
export function createSaving(
  ports: EditorPorts,
  stored: StoredDocument | undefined,
  parts: SavingParts,
): Saving {
  const { repository } = ports;
  if (repository === undefined) return NOT_SAVING;
  const watch: Watch = { quiet: false, disposed: false };
  const autosave = createAutosaveFor({ ...ports, repository }, stored, parts, watch);
  parts.core.saveStatus = autosave.status;
  let seen = parts.views.view();
  const stopWatching = parts.views.subscribe((view) => {
    const moved = view.camera !== seen.camera || !sameIds(view.selection, seen.selection);
    seen = view;
    if (moved && !watch.quiet) autosave.sessionChanged();
  });
  const stale = (): boolean => autosave.status.type === 'stale';
  const loadNewer = async (): Promise<void> => {
    if (!stale()) return;
    const result = await repository.load();
    // The answer may come after the editor was disposed or another answer was given.
    if (watch.disposed || result.type !== 'loaded' || !stale()) return;
    showStored(parts, autosave, result.stored);
    watch.quiet = true;
    parts.publish();
    watch.quiet = false;
  };
  return {
    saveNow: () => {
      autosave.saveNow();
    },
    resolveStale: (choice) => {
      if (choice === 'load') return loadNewer();
      autosave.keep();
      return Promise.resolve();
    },
    dispose: () => {
      watch.disposed = true;
      autosave.dispose();
      stopWatching();
    },
  };
}
