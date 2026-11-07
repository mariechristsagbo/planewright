export interface FoundationItem {
  readonly name: string;
  readonly detail: string;
}

/** The one-line state of this build, shown as the page's status; keep in sync with the README. */
export const BUILD_STATUS =
  'Pre-release — navigation only: you can pan and zoom an empty canvas, but nothing can be drawn yet.';

/** Facts about what this pre-release build contains; keep in sync with the README. */
export const FOUNDATION_CONTENTS: readonly FoundationItem[] = [
  {
    name: 'Navigation-only editor surface',
    detail:
      'An empty canvas that pans and zooms with the wheel, the keyboard, a middle-button drag, Space+drag, the Hand tool and two-finger touch gestures, with a tool bar and Undo and Redo controls.',
  },
  {
    name: 'Canvas engine and renderer',
    detail:
      'The engine’s document model, scene store, undo history, camera, gestures, commands and Selection tool, and its Canvas 2D renderer. Nothing creates or changes elements yet.',
  },
  {
    name: 'Collaboration service skeleton',
    detail:
      'Node.js WebSocket service with a health endpoint and a hello handshake; it exchanges no drawing data.',
  },
  {
    name: 'Shared protocol package',
    detail: 'Pre-release wire protocol definitions used by both the web shell and the service.',
  },
  {
    name: 'Quality gates',
    detail:
      'Formatting, linting, strict type checking, tests, build, dependency audit, guardrails and secret scanning.',
  },
];

export const NOT_YET_IMPLEMENTED: readonly string[] = [
  'Drawing shapes, lines, freehand strokes and text',
  'Moving, resizing, rotating and editing elements; the Selection tool works, but nothing can be drawn yet to select',
  'Undoing and redoing: nothing changes the drawing, so Undo and Redo stay disabled',
  'Saving, loading and exporting drawings',
  'Real-time collaboration',
];
