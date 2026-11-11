/** The repository's page, which About this build and the menu link to. */
export const REPOSITORY_URL = 'https://github.com/mariechristsagbo/planewright';

export interface FoundationItem {
  readonly name: string;
  readonly detail: string;
}

/**
 * The one-line state of this build, which About this build and the empty-canvas note say; keep it
 * in sync with the README.
 */
export const BUILD_STATUS =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.';

/** Facts about what this pre-release build contains; keep in sync with the README. */
export const FOUNDATION_CONTENTS: readonly FoundationItem[] = [
  {
    name: 'Editor surface',
    detail:
      'A canvas that pans and zooms with the wheel, the keyboard, a middle-button drag, Space+drag, the Hand tool and two-finger touch gestures, with a tool bar for the rectangle, ellipse, diamond, line, freehand and text tools and tool lock, a text area for typing texts over the canvas, a list of the drawn elements that selects, nudges and deletes them from the keyboard, Enter to draw at the centre of the canvas, Undo, Redo and zoom controls, and a live region that announces each change to screen readers.',
  },
  {
    name: 'Canvas engine and renderer',
    detail:
      'The engine’s document model, scene store, undo history, camera, gestures, commands, Selection tool, transforms, creation tools and text editing, and its Canvas 2D renderer, which draws texts in three bundled open-licence fonts. Drawn elements can be selected, moved, resized, rotated, duplicated, deleted and nudged, a double-click edits a text again, and each creation or edit is one undo step.',
  },
  {
    name: 'Saving in this browser',
    detail:
      'The drawing, its view and its selection are saved in this browser’s IndexedDB storage within a second of each change and come back after a reload, with the Selection tool and an empty undo history. When another tab has saved a newer version, this tab stops saving until you load that version or keep this one, and a failed save is reported and tried again.',
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
  'Files: opening, saving and exporting drawings as files; a drawing is kept only in this browser',
  'Real-time collaboration',
];
