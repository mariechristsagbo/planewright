// The chrome's 35 original glyphs (ADR 0012, decision 3): 34 interface glyphs and the mark, drawn
// for Planewright from what each control does, traced from nothing and taken from no icon set. Each
// is built from geometric primitives on a 20 px grid, inside a 2 px margin: lines, rectangles,
// circles, ellipses, polylines, polygons, dots, and paths of straight segments and circular arcs
// alone. The Icon component (icons.tsx) strokes them 1.5 px wide in currentColor, with round caps
// and joins.

/** One geometric primitive, in the grid's units; a dot is filled, everything else stroked. */
export type Primitive =
  | readonly ['line', x1: number, y1: number, x2: number, y2: number]
  | readonly ['rect', x: number, y: number, width: number, height: number, radius: number]
  | readonly ['circle', cx: number, cy: number, r: number]
  | readonly ['ellipse', cx: number, cy: number, rx: number, ry: number]
  | readonly ['polyline', ...points: number[]]
  | readonly ['polygon', ...points: number[]]
  | readonly ['dot', cx: number, cy: number]
  | readonly ['path', d: string];

/** Every glyph's name: the tools, tool lock, history and zoom, the shell's controls, then the mark. */
export const ICON_NAMES = [
  'hand',
  'selection',
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'freehand',
  'text',
  'lock-open',
  'lock-closed',
  'undo',
  'redo',
  'zoom-out',
  'zoom-in',
  'zoom-fit',
  'zoom-reset',
  'select-all',
  'menu',
  'more',
  'elements',
  'keyboard',
  'info',
  'external-link',
  'close',
  'check',
  'chevron-down',
  'chevron-up',
  'status-problem',
  'status-tabs',
  'duplicate',
  'delete',
  'edit-text',
  'details',
  'multiple',
  'mark',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** A magnifying glass's lens and handle, which the zoom glyphs share. */
const LENS: readonly Primitive[] = [
  ['circle', 8.75, 8.75, 5.75],
  ['line', 13, 13, 17, 17],
];

/** A padlock's body and keyhole, under an open or a closed shackle. */
const PADLOCK: readonly Primitive[] = [
  ['rect', 4.5, 9, 11, 8.5, 1.5],
  ['line', 10, 12, 10, 14.5],
];

/** The glyphs, each a list of primitives on the 20 px grid. */
export const GLYPHS: Readonly<Record<IconName, readonly Primitive[]>> = {
  hand: [
    [
      'path',
      'M6.5 12V5.25a1.25 1.25 0 0 1 2.5 0V9M9 9V4.5a1.25 1.25 0 0 1 2.5 0V9M11.5 9V5.25a1.25 1.25 0 0 1 2.5 0V10M14 10V7a1.25 1.25 0 0 1 2.5 0v5a5.5 5.5 0 0 1-5.5 5.5h-1a5 5 0 0 1-3.9-1.9l-2.6-3.3a1.25 1.25 0 0 1 1.95-1.55L6.5 12',
    ],
  ],
  selection: [
    ['polygon', 5, 3, 5, 15.5, 8.4, 12.4, 10.6, 16.9, 12.4, 16.1, 10.2, 11.6, 14.8, 11.5],
  ],
  rectangle: [['rect', 3, 4.5, 14, 11, 1.5]],
  ellipse: [['ellipse', 10, 10, 7, 5.25]],
  diamond: [['polygon', 10, 2.75, 17.25, 10, 10, 17.25, 2.75, 10]],
  line: [
    ['line', 6.3, 13.7, 13.7, 6.3],
    ['circle', 5, 15, 1.75],
    ['circle', 15, 5, 1.75],
  ],
  freehand: [['path', 'M2.75 13a3 3 0 0 1 6 0a2.25 2.25 0 0 0 4.5 0a2.5 2.5 0 0 1 4.5-1.5']],
  text: [
    ['polyline', 4.5, 6.5, 4.5, 4.5, 15.5, 4.5, 15.5, 6.5],
    ['line', 10, 4.5, 10, 15.5],
    ['line', 7.5, 15.5, 12.5, 15.5],
  ],
  'lock-open': [...PADLOCK, ['path', 'M7 9V5a3 3 0 0 1 6 0v1.5']],
  'lock-closed': [...PADLOCK, ['path', 'M7 9V6a3 3 0 0 1 6 0v3']],
  undo: [
    ['polyline', 7.5, 4.5, 4, 8, 7.5, 11.5],
    ['path', 'M4 8h8.25a3.75 3.75 0 0 1 0 7.5H9'],
  ],
  redo: [
    ['polyline', 12.5, 4.5, 16, 8, 12.5, 11.5],
    ['path', 'M16 8H7.75a3.75 3.75 0 0 0 0 7.5H11'],
  ],
  'zoom-out': [...LENS, ['line', 6.25, 8.75, 11.25, 8.75]],
  'zoom-in': [...LENS, ['line', 6.25, 8.75, 11.25, 8.75], ['line', 8.75, 6.25, 8.75, 11.25]],
  'zoom-fit': [
    ['polyline', 3, 7, 3, 3, 7, 3],
    ['polyline', 13, 3, 17, 3, 17, 7],
    ['polyline', 17, 13, 17, 17, 13, 17],
    ['polyline', 7, 17, 3, 17, 3, 13],
    ['rect', 7, 7, 6, 6, 1],
  ],
  'zoom-reset': [...LENS, ['rect', 6.75, 6.75, 4, 4, 0.5]],
  'select-all': [
    ['rect', 3, 3, 14, 14, 2],
    ['rect', 6, 6, 4, 4, 0.75],
    ['circle', 12.25, 12.25, 1.75],
  ],
  menu: [
    ['line', 4, 6, 16, 6],
    ['line', 4, 10, 16, 10],
    ['line', 4, 14, 16, 14],
  ],
  more: [
    ['dot', 5, 10],
    ['dot', 10, 10],
    ['dot', 15, 10],
  ],
  elements: [
    ['rect', 3.5, 4.25, 2.5, 2.5, 0.5],
    ['circle', 4.75, 10, 1.25],
    ['polygon', 4.75, 13.25, 6, 14.5, 4.75, 15.75, 3.5, 14.5],
    ['line', 9, 5.5, 16.5, 5.5],
    ['line', 9, 10, 16.5, 10],
    ['line', 9, 14.5, 16.5, 14.5],
  ],
  keyboard: [
    ['rect', 2.5, 5, 15, 10, 2],
    ['dot', 6, 8.5],
    ['dot', 10, 8.5],
    ['dot', 14, 8.5],
    ['line', 7, 12, 13, 12],
  ],
  info: [
    ['circle', 10, 10, 7.25],
    ['line', 10, 9.25, 10, 13.75],
    ['dot', 10, 6.5],
  ],
  'external-link': [
    ['path', 'M15 11.5V15a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V6.5A1.5 1.5 0 0 1 5 5h3.5'],
    ['polyline', 12, 3.5, 16.5, 3.5, 16.5, 8],
    ['line', 16.5, 3.5, 9.5, 10.5],
  ],
  close: [
    ['line', 5, 5, 15, 15],
    ['line', 15, 5, 5, 15],
  ],
  check: [['polyline', 4, 10.5, 8, 14.5, 16, 6]],
  'chevron-down': [['polyline', 5, 7.5, 10, 12.5, 15, 7.5]],
  'chevron-up': [['polyline', 5, 12.5, 10, 7.5, 15, 12.5]],
  'status-problem': [
    ['polygon', 10, 3, 17.5, 16.5, 2.5, 16.5],
    ['line', 10, 8, 10, 11.5],
    ['dot', 10, 14],
  ],
  'status-tabs': [
    ['rect', 2.75, 7.5, 10.5, 8.5, 1.5],
    ['line', 2.75, 10.25, 13.25, 10.25],
    [
      'path',
      'M6.75 7.5V5.5A1.5 1.5 0 0 1 8.25 4h7.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-2.5',
    ],
  ],
  duplicate: [
    ['rect', 7, 7, 10, 10, 1.5],
    ['path', 'M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7'],
  ],
  delete: [
    ['line', 3.5, 5.5, 16.5, 5.5],
    ['path', 'M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5'],
    ['path', 'M5 5.5l.85 10.65a1.5 1.5 0 0 0 1.5 1.35h5.3a1.5 1.5 0 0 0 1.5-1.35L15 5.5'],
    ['line', 8.5, 8.75, 8.5, 14],
    ['line', 11.5, 8.75, 11.5, 14],
  ],
  'edit-text': [
    ['polyline', 3, 5.5, 3, 4, 11, 4, 11, 5.5],
    ['line', 7, 4, 7, 15],
    ['line', 5.5, 15, 8.5, 15],
    ['line', 15, 6, 15, 16],
    ['line', 13.5, 6, 16.5, 6],
    ['line', 13.5, 16, 16.5, 16],
  ],
  details: [
    ['rect', 3, 3.5, 14, 13, 2],
    ['line', 6.5, 7.5, 13.5, 7.5],
    ['line', 6.5, 10, 13.5, 10],
    ['line', 6.5, 12.5, 10.5, 12.5],
  ],
  multiple: [
    ['rect', 2.75, 2.75, 7.5, 7.5, 1],
    ['circle', 13.5, 13.5, 3.75],
  ],
  mark: [
    ['polygon', 6.5, 3.5, 17, 3.5, 13.5, 16.5, 3, 16.5],
    ['line', 6.5, 3.5, 13.5, 16.5],
  ],
};
