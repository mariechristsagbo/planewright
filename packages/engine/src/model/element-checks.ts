import { ARROW_HEADS, ARROW_ROUTES, ELEMENT_KINDS } from './elements.ts';
import type {
  ArrowElement,
  Attachment,
  Box,
  Element,
  ElementKind,
  FrameElement,
  FreehandElement,
  ImageElement,
  LineElement,
  NoteElement,
  Point,
  ShapeElement,
  TextElement,
} from './elements.ts';
import {
  coordinate,
  elementId,
  fileId,
  groupId,
  link,
  orderKey,
  points,
  revision,
  rotation,
  size,
  style,
  textBlock,
  unit,
} from './field-checks.ts';
import {
  INVALID,
  boolean,
  fieldPath,
  isRecord,
  listOf,
  oneOf,
  record,
  refine,
  text,
} from './json-check.ts';
import type { Check, Issues } from './json-check.ts';
import { LIMITS } from './limits.ts';

// One record check per kind, with the fields of the domain model; an element's kind picks it.

const common = {
  id: elementId,
  order: orderKey,
  x: coordinate,
  y: coordinate,
  rotation,
  style,
  locked: boolean,
  group: { optional: groupId },
  link: { optional: link },
  rev: revision,
};

const boxSize = { width: size, height: size };

const shape = record<ShapeElement>({
  ...common,
  kind: oneOf(['rectangle', 'ellipse', 'diamond']),
  ...boxSize,
  label: { optional: textBlock },
});

const line = record<LineElement>({
  ...common,
  kind: oneOf(['line']),
  points: points(2, LIMITS.linePoints),
});

const freehand = refine(
  record<FreehandElement>({
    ...common,
    kind: oneOf(['freehand']),
    points: points(1, LIMITS.freehandPoints),
    pressures: { optional: listOf(unit, { min: 0, max: LIMITS.freehandPoints }) },
  }),
  (element, path, issues) => {
    if (element.pressures !== undefined && element.pressures.length !== element.points.length) {
      issues.push({ path: fieldPath(path, 'pressures'), problem: 'length-mismatch' });
    }
  },
);

const textElement = record<TextElement>({
  ...common,
  kind: oneOf(['text']),
  ...boxSize,
  content: textBlock,
});

const attachment = record<Attachment>({
  target: elementId,
  anchor: record<Point>({ x: unit, y: unit }),
});

/** An attachment never targets its own connector; whether the target exists is checked later. */
function notSelfAttached(arrow: ArrowElement, path: string, issues: Issues): void {
  for (const end of ['start', 'end'] as const) {
    if (arrow[end]?.target === arrow.id) {
      issues.push({ path: fieldPath(fieldPath(path, end), 'target'), problem: 'self-reference' });
    }
  }
}

const arrow = refine(
  record<ArrowElement>({
    ...common,
    kind: oneOf(['arrow']),
    points: points(2, LIMITS.linePoints),
    start: { optional: attachment },
    end: { optional: attachment },
    heads: record<ArrowElement['heads']>({ start: oneOf(ARROW_HEADS), end: oneOf(ARROW_HEADS) }),
    route: oneOf(ARROW_ROUTES),
    label: { optional: textBlock },
  }),
  notSelfAttached,
);

const note = record<NoteElement>({
  ...common,
  kind: oneOf(['note']),
  ...boxSize,
  label: textBlock,
});

const image = record<ImageElement>({
  ...common,
  kind: oneOf(['image']),
  ...boxSize,
  file: fileId,
  crop: { optional: record<Box>({ x: coordinate, y: coordinate, ...boxSize }) },
});

const frame = record<FrameElement>({ ...common, kind: oneOf(['frame']), ...boxSize, name: text() });

const BY_KIND: Readonly<Record<ElementKind, Check<Element>>> = {
  rectangle: shape,
  ellipse: shape,
  diamond: shape,
  line,
  freehand,
  text: textElement,
  arrow,
  note,
  image,
  frame,
};

const kindOf = oneOf(ELEMENT_KINDS);

/** One element of any kind; without a known kind, nothing else of it can be checked. */
export const checkElement: Check<Element> = (value, path, issues) => {
  if (!isRecord(value)) {
    issues.push({ path, problem: 'not-object' });
    return INVALID;
  }
  const kindPath = fieldPath(path, 'kind');
  if (!Object.hasOwn(value, 'kind')) {
    issues.push({ path: kindPath, problem: 'missing' });
    return INVALID;
  }
  const kind = kindOf(value['kind'], kindPath, issues);
  return kind === INVALID ? INVALID : BY_KIND[kind](value, path, issues);
};
