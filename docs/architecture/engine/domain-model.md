# Domain model

The engine's document model, as decided in [ADR 0005](../../adr/0005-document-model.md). The types
below are the contract for the `model` layer ([modules](modules.md#engine-layers)); field names and
structure are Planewright's own. P0 implements the kinds marked P0; the others are fixed now so
that P1 and P2 add to the model without breaking it ([model-shaping requirements](requirements.md#model-shaping-behaviour)).

## Identifiers and primitive types

```ts
const brand: unique symbol = Symbol('brand'); // not exported, so only the model can brand
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type ElementId = Brand<string, 'ElementId'>; // 22 base64url characters, 128 random bits
export type GroupId = Brand<string, 'GroupId'>; // same form
export type ClientId = Brand<string, 'ClientId'>; // same form, one per editor session
export type OrderKey = Brand<string, 'OrderKey'>; // see "Drawing order"
export type FileId = Brand<string, 'FileId'>; // 64 lower-case hex characters: SHA-256 of the bytes
export type Color = Brand<string, 'Color'>; // '#rrggbb' or '#rrggbbaa', lower case, sRGB

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

Branded strings are created only by the codec and by the identifier, order-key and colour helpers,
so a plain string can never be used where an identifier is expected. The brand key is a real symbol
rather than an ambient `declare`, which the engine's ESLint boundary refuses
([ADR 0004](../../adr/0004-canvas-engine-package-boundaries.md)). The identifier helpers check the
form only, 22 characters of the base64url alphabet; which bits they carry is the identifier
source's concern.

## Geometry of an element

Every element has an **unrotated local box**: origin `x, y` (its top-left corner in scene units),
a width and a height, and a `rotation` in radians in `[0, 2π)` about the box centre.

- **Box kinds** (rectangle, ellipse, diamond, text, note, image, frame) store `width` and `height`.
- **Point kinds** (line, arrow, freehand) store `points` relative to the origin. After every edit
  the points are normalised so that their smallest x and smallest y are 0: the origin moves, the
  points shift, and the drawing does not move. Their width and height are derived from the points.
  A rotation turns the box about its centre, which moves when the size changes, so the new origin
  is solved to keep every unchanged point where it was in scene space: if normalising shifts the
  points by `−m` (`m` is their smallest x and y before it) and the size changes by `d`, the new
  origin is `o + R(m + d / 2) − d / 2`, where `R` rotates by the element's rotation. Without a
  rotation this is `o + m`.
- A **text** stores its measured width and height, so a document lays out and hit-tests without its
  fonts. The size is measured again when the text, its font or a loaded font changes.

The box of a rotated element is drawn by rotating its local box about its centre. Hit testing,
resize and export all work in this local frame (REQ-T02).

## Style

```ts
export interface Stroke {
  readonly color: Color;
  readonly width: number; // scene units, (0, 100]
  readonly dash: 'solid' | 'dashed' | 'dotted';
}

export interface Fill {
  readonly color: Color;
  readonly pattern: 'solid' | 'hatch' | 'crosshatch';
}

export interface Style {
  readonly stroke: Stroke;
  readonly fill: Fill | null; // null draws no fill: the shape is hit on its outline only (REQ-S01)
  readonly opacity: number; // [0, 1]
  readonly corners: 'sharp' | 'round';
  readonly sketch: 0 | 1 | 2; // 0 draws exact geometry; 1 and 2 are reserved for the P1 sketch styles
}
```

P0 creates every element with the editor's current default style (REQ-C12). The initial defaults
are Planewright's own: stroke `#1e2430`, width 2, solid; no fill; opacity 1; round corners for
rectangles and diamonds, and sharp corners for every other kind; sketch 0. The P1 style issue
(REQ-M06) adds the palette and the controls that change them.

## Text

```ts
export type FontFamily = 'sans' | 'hand' | 'mono'; // Planewright family names, mapped to bundled fonts

export interface FontSpec {
  readonly family: FontFamily;
  readonly size: number; // scene units, [1, 1000]
  readonly lineHeight: number; // multiple of the size, [1, 3]
}

export interface TextBlock {
  readonly text: string; // at most 100,000 characters, line breaks as '\n'
  readonly font: FontSpec;
  readonly align: 'left' | 'center' | 'right';
}
```

P0 texts use `sans` at size 20 with line height 1.25. Which open-licence font files back each
family is decided, with its own ADR, in the text issue; the reference's fonts are never used
([ADR 0003](../../adr/0003-clean-room-reference-policy.md)).

## Elements

```ts
interface ElementCommon {
  readonly id: ElementId;
  readonly order: OrderKey;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly style: Style;
  readonly locked: boolean; // P1 behaviour (REQ-M07); always false in P0
  readonly group?: GroupId; // innermost group, P1 (REQ-M04)
  readonly link?: string; // P1 (REQ-M08)
  readonly rev: number; // incremented by every change to this element
}

export interface ShapeElement extends ElementCommon {
  readonly kind: 'rectangle' | 'ellipse' | 'diamond'; // P0
  readonly width: number;
  readonly height: number;
  readonly label?: TextBlock; // P1 (REQ-M02)
}

export interface LineElement extends ElementCommon {
  readonly kind: 'line'; // P0
  readonly points: readonly Point[]; // at least 2
}

export interface FreehandElement extends ElementCommon {
  readonly kind: 'freehand'; // P0
  readonly points: readonly Point[]; // at least 1; one point is a dot (REQ-C07)
  readonly pressures?: readonly number[]; // one per point in [0, 1], kept when reported (REQ-C08)
}

export interface TextElement extends ElementCommon {
  readonly kind: 'text'; // P0
  readonly width: number; // measured
  readonly height: number; // measured
  readonly content: TextBlock;
}

export interface Attachment {
  readonly target: ElementId;
  readonly anchor: Point; // in [0, 1] × [0, 1] of the target's local box
}

export interface ArrowElement extends ElementCommon {
  readonly kind: 'arrow'; // P1 (REQ-M01)
  readonly points: readonly Point[]; // at least 2
  readonly start?: Attachment;
  readonly end?: Attachment;
  readonly heads: { readonly start: ArrowHead; readonly end: ArrowHead };
  readonly route: 'straight' | 'curved' | 'elbow';
  readonly label?: TextBlock;
}

export type ArrowHead = 'none' | 'arrow' | 'triangle' | 'dot' | 'bar';

export interface NoteElement extends ElementCommon {
  readonly kind: 'note'; // P1 (REQ-M03)
  readonly width: number; // equal to height while the note keeps its default shape
  readonly height: number;
  readonly label: TextBlock;
}

export interface ImageElement extends ElementCommon {
  readonly kind: 'image'; // P2 (REQ-M10)
  readonly width: number;
  readonly height: number;
  readonly file: FileId;
  readonly crop?: Box; // in the image's own pixels
}

export interface FrameElement extends ElementCommon {
  readonly kind: 'frame'; // P2 (REQ-M09); membership is decided in its issue
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

export type Element =
  | ShapeElement
  | LineElement
  | FreehandElement
  | TextElement
  | ArrowElement
  | NoteElement
  | ImageElement
  | FrameElement;

export type ElementKind = Element['kind'];

export interface GroupRecord {
  readonly id: GroupId;
  readonly parent?: GroupId;
}

export interface CanvasState {
  readonly background: Color;
}

export interface DocumentState {
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly groups: ReadonlyMap<GroupId, GroupRecord>;
  readonly canvas: CanvasState;
  readonly rev: number; // in memory: raised by every applied change set, never saved
}
```

Selection, camera, tool, theme and preferences are editor or session state, not document state.

## Drawing order

Each element's `order` key places it in the drawing order: elements are drawn by ascending key,
with equal keys ordered by identifier, so the order is total and the same on every machine
(REQ-K02).

- Keys are strings over the 62 digits `0-9`, `A-Z`, `a-z`, in that code-unit order, read as a
  fraction in `[0, 1)`. Comparison is by code unit, never by locale.
- A key never ends with `0`; otherwise no key could fall between `k` and `k0`.
- `keyBetween(lower, upper)` returns the shortest key strictly between two keys, either of which
  may be absent for the ends of the order. `keysBetween(lower, upper, n)` spreads `n` keys evenly
  so that repeated inserts at one place keep keys short.
- Bring forward and send backward give the element a key between the next two neighbours in that
  direction; bring to front and send to back give it a key past the last or before the first
  (REQ-M05). Paste and duplicate give each copy a key just above its original's, in the originals'
  order.
- When an operation would produce a key longer than 32 characters, the transaction reassigns short
  keys to a run of neighbours in the same change set.

## Groups

`GroupRecord.parent` makes groups a forest; an element's `group` names its innermost group. The
outermost group of an element is found by following parents. Grouping creates a record (with the
selection's common innermost group as its parent) and points each selected element at it;
ungrouping deletes the record and points its members at its parent. A record with no members and
no child group is removed in the change set that empties it. The codec rejects cycles and unknown
parents (REQ-M04).

## Invariants and limits

The codec enforces these on every untrusted input, and the scene store refuses any change set that
would break one of them, the encoded size aside; its tests assert that the codec accepts every
document the store holds:

- identifiers are well formed and unique; an element's `group`, a group's `parent` and an
  attachment's `target` exist; an attachment never targets its own connector;
- numbers are finite; `|x|` and `|y|` are at most 10⁹; sizes are in `[0, 10⁷]`; `rotation` is in
  `[0, 2π)`; `opacity` in `[0, 1]`; a stroke width in `(0, 100]`;
- point kinds hold at most 10,000 points (line, arrow) or 50,000 (freehand), normalised to a
  smallest x and y of 0 within 10⁻⁹; pressures, when present, match the points one to one;
- a text is at most 100,000 characters; a link is at most 2,048 characters with the scheme
  `http`, `https` or `mailto`;
- a document holds at most 100,000 elements, and an encoded document over 50 MB is refused before
  it is parsed;
- colours match `#rrggbb` or `#rrggbbaa` in lower case.

Validation returns either a document or a list of errors with their JSON paths; it never repairs
or drops part of its input (REQ-P07). The codec reads these rules as follows:

- lengths count UTF-16 code units, and the 50 MB limit is 50,000,000 bytes of UTF-8, where a lone
  surrogate counts as the 3 bytes of U+FFFD;
- a text holds no carriage return, since its line breaks are `\n`, and a link's scheme is compared
  without regard to case;
- a point's coordinates lie within ±10⁷ and the points' extent within the size limit; a revision is
  a non-negative integer;
- a field that the model does not have is an error, never dropped, and an own `__proto__` field is
  never read;
- order keys and frame names have no length limit of their own beyond the input's size: keys longer
  than 32 characters are reassigned by the scene's transactions, not refused;
- an image's file identifier is checked for its form; whether the file exists is checked against
  the files store that P2 adds.

## Encoded form

The encoded document is JSON. Maps become arrays: elements sorted by drawing order and groups by
identifier, so that saving the same document twice gives the same bytes. The encoder writes it
without white space, with every object's keys in a fixed order and optional fields only when
present; an element's keys come in the order `id`, `kind`, `order`, `x`, `y`, then `width` and
`height` or `points` and `pressures`, `rotation`, `style`, `locked`, `group`, `link`, `content`,
`start`, `end`, `heads`, `route`, `label`, `file`, `crop`, `name` and `rev`. The example below is
indented for reading.

```json
{
  "format": "planewright",
  "schema": 1,
  "canvas": { "background": "#ffffff" },
  "groups": [],
  "elements": [
    {
      "id": "pW3xK9vT2mQe7LhR0aZc5Q",
      "kind": "rectangle",
      "order": "V",
      "x": 300,
      "y": 180,
      "width": 120,
      "height": 100,
      "rotation": 0,
      "style": {
        "stroke": { "color": "#1e2430", "width": 2, "dash": "solid" },
        "fill": null,
        "opacity": 1,
        "corners": "round",
        "sketch": 0
      },
      "locked": false,
      "rev": 1
    }
  ]
}
```

The identifier in the example is illustrative; real identifiers come from the `IdSource` port.

## Requirements served

REQ-C07, REQ-C08, REQ-C12, REQ-K02, REQ-M01 to REQ-M10, REQ-P03, REQ-P07 and REQ-T02.
