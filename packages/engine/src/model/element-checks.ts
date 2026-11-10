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
  valueChecks,
} from './json-check.ts';
import type { Check, Fields, Issues } from './json-check.ts';
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

const shapeFields = {
  ...common,
  kind: oneOf(['rectangle', 'ellipse', 'diamond']),
  ...boxSize,
  label: { optional: textBlock },
} satisfies Fields<ShapeElement>;

const lineFields = {
  ...common,
  kind: oneOf(['line']),
  points: points(2, LIMITS.linePoints),
} satisfies Fields<LineElement>;

const freehandFields = {
  ...common,
  kind: oneOf(['freehand']),
  points: points(1, LIMITS.freehandPoints),
  pressures: { optional: listOf(unit, { min: 0, max: LIMITS.freehandPoints }) },
} satisfies Fields<FreehandElement>;

const textFields = {
  ...common,
  kind: oneOf(['text']),
  ...boxSize,
  content: textBlock,
} satisfies Fields<TextElement>;

const attachment = record<Attachment>({
  target: elementId,
  anchor: record<Point>({ x: unit, y: unit }),
});

const arrowFields = {
  ...common,
  kind: oneOf(['arrow']),
  points: points(2, LIMITS.linePoints),
  start: { optional: attachment },
  end: { optional: attachment },
  heads: record<ArrowElement['heads']>({ start: oneOf(ARROW_HEADS), end: oneOf(ARROW_HEADS) }),
  route: oneOf(ARROW_ROUTES),
  label: { optional: textBlock },
} satisfies Fields<ArrowElement>;

const noteFields = {
  ...common,
  kind: oneOf(['note']),
  ...boxSize,
  label: textBlock,
} satisfies Fields<NoteElement>;

const imageFields = {
  ...common,
  kind: oneOf(['image']),
  ...boxSize,
  file: fileId,
  crop: { optional: record<Box>({ x: coordinate, y: coordinate, ...boxSize }) },
} satisfies Fields<ImageElement>;

const frameFields = {
  ...common,
  kind: oneOf(['frame']),
  ...boxSize,
  name: text(),
} satisfies Fields<FrameElement>;

/** A freehand's pressures, when it has them, are one per point. */
function pressuresMatch(element: FreehandElement, path: string, issues: Issues): void {
  if (element.pressures !== undefined && element.pressures.length !== element.points.length) {
    issues.push({ path: fieldPath(path, 'pressures'), problem: 'length-mismatch' });
  }
}

/** An attachment never targets its own connector; whether the target exists is checked later. */
function notSelfAttached(arrow: ArrowElement, path: string, issues: Issues): void {
  for (const end of ['start', 'end'] as const) {
    if (arrow[end]?.target === arrow.id) {
      issues.push({ path: fieldPath(fieldPath(path, end), 'target'), problem: 'self-reference' });
    }
  }
}

/**
 * The checks of an element that span its fields, which run once each field is valid: a
 * freehand's pressures match its points, and an arrow is not attached to itself.
 */
export function checkAcrossFields(element: Element, path: string, issues: Issues): void {
  if (element.kind === 'freehand') pressuresMatch(element, path, issues);
  if (element.kind === 'arrow') notSelfAttached(element, path, issues);
}

/** A kind's check: each of its fields, then the checks across them. */
const kindCheck = <T extends Element>(fields: Fields<T>): Check<T> =>
  refine(record<T>(fields), checkAcrossFields);

const shape = kindCheck<ShapeElement>(shapeFields);

const BY_KIND: Readonly<Record<ElementKind, Check<Element>>> = {
  rectangle: shape,
  ellipse: shape,
  diamond: shape,
  line: kindCheck<LineElement>(lineFields),
  freehand: kindCheck<FreehandElement>(freehandFields),
  text: kindCheck<TextElement>(textFields),
  arrow: kindCheck<ArrowElement>(arrowFields),
  note: kindCheck<NoteElement>(noteFields),
  image: kindCheck<ImageElement>(imageFields),
  frame: kindCheck<FrameElement>(frameFields),
};

/**
 * The check of a value of each field of each kind, by name: what checks a patch's values one by
 * one, as the kind's own check checks them.
 */
export const FIELD_CHECKS: Readonly<Record<ElementKind, ReadonlyMap<string, Check<unknown>>>> = {
  rectangle: valueChecks(shapeFields),
  ellipse: valueChecks(shapeFields),
  diamond: valueChecks(shapeFields),
  line: valueChecks(lineFields),
  freehand: valueChecks(freehandFields),
  text: valueChecks(textFields),
  arrow: valueChecks(arrowFields),
  note: valueChecks(noteFields),
  image: valueChecks(imageFields),
  frame: valueChecks(frameFields),
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
