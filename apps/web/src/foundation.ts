export interface FoundationItem {
  readonly name: string;
  readonly detail: string;
}

/** The one-line state of this build, shown as the page's status; keep in sync with the README. */
export const BUILD_STATUS =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them, but there is no saving or collaboration yet.';

/** Facts about what this pre-release build contains; keep in sync with the README. */
export const FOUNDATION_CONTENTS: readonly FoundationItem[] = [
  {
    name: 'Editor surface',
    detail:
      'A canvas that pans and zooms with the wheel, the keyboard, a middle-button drag, Space+drag, the Hand tool and two-finger touch gestures, with a tool bar for the rectangle, ellipse, diamond, line, freehand and text tools and tool lock, a text area for typing texts over the canvas, and Undo and Redo controls.',
  },
  {
    name: 'Canvas engine and renderer',
    detail:
      'The engine’s document model, scene store, undo history, camera, gestures, commands, Selection tool, transforms, creation tools and text editing, and its Canvas 2D renderer, which draws texts in three bundled open-licence fonts. Drawn elements can be selected, moved, resized, rotated, duplicated, deleted and nudged, a double-click edits a text again, and each creation or edit is one undo step.',
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
  'Text formatting: every text is left-aligned in one font and size, with no font picker, wrapping or labels in shapes',
  'Styles: every element is drawn in the one default style, with no way to change its colours, widths or fill',
  'Arrows, sticky notes, images and pressure-sensitive strokes',
  'Saving, loading and exporting drawings: a reload loses the drawing',
  'Real-time collaboration',
];
